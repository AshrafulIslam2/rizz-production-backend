import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcCosting,
  calcFactoryAllocation,
  calcFactoryLinePool,
  FINISH_MAN_FIELD_KEY,
  finishManRate,
  calcFactoryMonthlyTotal,
  activeEmployees,
  FactoryEmployee,
  getLine,
  inferProductLine,
  isProductLine,
  LABOUR_FIELD_KEY,
  PRODUCT_LINES,
  ProductLineKey,
  calcRetailCommonCostPerPair,
  mergeCostValues,
  money,
  num,
  PAIRS_PER_DOZEN,
  CostFieldLike,
} from './costing.calc';
import {
  DEFAULT_COST_FIELDS,
  DEFAULT_FACTORY_SETTINGS,
  DEFAULT_RETAIL_SETTINGS,
  FACTORY_SETTINGS_KEY,
  FactoryCostSettings,
  FIELD_SEED_VERSION,
  FIELD_SEED_VERSION_KEY,
  V1_SEED_LABELS,
  PREVIOUS_SEED_LABELS,
  V1_UPPER_SOLE_KEYS,
  RETAIL_SETTINGS_KEY,
  RetailCostSettings,
} from './costing.defaults';

const SECTIONS = ['UPPER', 'SOLE', 'FINISH', 'FACTORY', 'RETAIL_COMMON', 'RETAIL_PRODUCT'];
const BASES = ['PER_DOZEN', 'PER_PAIR', 'PER_MONTH'];
const CALCULATORS = ['DIRECT', 'SQFT', 'UNIT', 'SHEET', 'CHEMICAL'];

/** Turn a label into a stable snake_case key. */
function slugKey(label: string, section: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${section.toLowerCase()}_${base || 'field'}`;
}

@Injectable()
export class CostingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cost field definitions ────────────────────────────────────────────────

  /**
   * Bring the stored field definitions up to the current seed version.
   *
   * Runs once (guarded by a version number in Setting) rather than on every
   * request. Three things happen, in this order:
   *
   *   1. Missing default fields are created.
   *   2. Fields that exist in both versions are upgraded in place — they keep
   *      their id and key, so any saved amount stays attached. A label the
   *      admin renamed is left alone; only untouched seed labels are refreshed.
   *   3. Flat v1 Upper/Sole fields the structured set replaces are archived,
   *      never deleted, so nothing that references them can break.
   */
  private async syncDefaultFields(fromVersion = 0): Promise<void> {
    const existing = await this.prisma.costFieldDefinition.findMany();
    const byKey = new Map(existing.map((f) => [f.key, f]));
    const defaultKeys = new Set(DEFAULT_COST_FIELDS.map((f) => f.key));

    const creates: any[] = [];
    const updates: Promise<unknown>[] = [];

    DEFAULT_COST_FIELDS.forEach((f, i) => {
      const current = byKey.get(f.key);

      if (!current) {
        creates.push({
          key: f.key,
          label: f.label,
          section: f.section as any,
          basis: f.basis as any,
          calculator: (f.calculator ?? 'DIRECT') as any,
          group: f.group ?? null,
          mode: f.mode ?? null,
          help_text: f.help_text ?? null,
          sort_order: i,
        });
        return;
      }

      // Only refresh the label when it still reads exactly as some version
      // seeded it — an admin rename always wins.
      const seededBefore = [V1_SEED_LABELS[f.key], ...(PREVIOUS_SEED_LABELS[f.key] ?? [])].filter(Boolean);
      const untouched = current.label === f.label || seededBefore.includes(current.label);
      const label = untouched ? f.label : current.label;

      updates.push(
        this.prisma.costFieldDefinition.update({
          where: { id: current.id },
          data: {
            label,
            section: f.section as any,
            basis: f.basis as any,
            calculator: (f.calculator ?? 'DIRECT') as any,
            group: f.group ?? null,
            mode: f.mode ?? null,
            help_text: f.help_text ?? current.help_text,
            sort_order: i,
            // The v2 restructure re-introduced some v1 fields, so it had to bring
            // them back. Later upgrades leave the admin's archive choices alone.
            ...(fromVersion < 2 ? { is_archived: false } : {}),
          },
        }),
      );
    });

    // v1 Upper/Sole rows with no place in the structured set. Keys reused by
    // v2 are filtered out here, so an upgraded field is never archived by
    // mistake.
    const retired = V1_UPPER_SOLE_KEYS.filter((k) => !defaultKeys.has(k) && byKey.has(k));

    if (creates.length) {
      await this.prisma.costFieldDefinition.createMany({ data: creates, skipDuplicates: true });
    }
    if (updates.length) await Promise.all(updates);
    if (retired.length) {
      await this.prisma.costFieldDefinition.updateMany({
        where: { key: { in: retired } },
        data: { is_archived: true, is_active: false },
      });
    }

    await this.prisma.setting.upsert({
      where: { key: FIELD_SEED_VERSION_KEY },
      update: { value: { version: FIELD_SEED_VERSION } as any },
      create: { key: FIELD_SEED_VERSION_KEY, value: { version: FIELD_SEED_VERSION } as any },
    });
  }

  /**
   * Fields, seeding or upgrading the defaults so the form is usable out of the
   * box. Once the stored version matches, this is a single cheap read.
   */
  async listFields(includeArchived = false) {
    const marker = await this.prisma.setting.findUnique({
      where: { key: FIELD_SEED_VERSION_KEY },
    });
    const storedVersion = num((marker?.value as any)?.version);
    if (storedVersion < FIELD_SEED_VERSION) {
      await this.syncDefaultFields(storedVersion);
    }

    return this.prisma.costFieldDefinition.findMany({
      where: includeArchived ? {} : { is_archived: false },
      orderBy: [{ section: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  async createField(dto: any) {
    const label = String(dto?.label ?? '').trim();
    if (!label) throw new BadRequestException('label is required');
    const section = String(dto?.section ?? '').toUpperCase();
    if (!SECTIONS.includes(section)) {
      throw new BadRequestException(`section must be one of ${SECTIONS.join(', ')}`);
    }
    const basis = String(dto?.basis ?? 'PER_DOZEN').toUpperCase();
    if (!BASES.includes(basis)) {
      throw new BadRequestException(`basis must be one of ${BASES.join(', ')}`);
    }
    const calculator = String(dto?.calculator ?? 'DIRECT').toUpperCase();
    if (!CALCULATORS.includes(calculator)) {
      throw new BadRequestException(`calculator must be one of ${CALCULATORS.join(', ')}`);
    }

    // Keys must be unique; a repeated label gets a numeric suffix rather than
    // failing, so the admin is never blocked by a name clash.
    let key = String(dto?.key ?? '').trim() || slugKey(label, section);
    let n = 2;
    while (await this.prisma.costFieldDefinition.findUnique({ where: { key } })) {
      key = `${slugKey(label, section)}_${n++}`;
    }

    const last = await this.prisma.costFieldDefinition.findFirst({
      where: { section: section as any },
      orderBy: { sort_order: 'desc' },
    });

    return this.prisma.costFieldDefinition.create({
      data: {
        key,
        label,
        section: section as any,
        basis: basis as any,
        calculator: calculator as any,
        group: dto?.group ? String(dto.group) : null,
        mode: dto?.mode ? String(dto.mode).toUpperCase() : null,
        help_text: dto?.help_text ?? null,
        sort_order: (last?.sort_order ?? -1) + 1,
      },
    });
  }

  async updateField(id: string, dto: any) {
    const existing = await this.prisma.costFieldDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cost field not found');

    const data: any = {};
    if (dto?.label !== undefined) data.label = String(dto.label).trim();
    if (dto?.help_text !== undefined) data.help_text = dto.help_text || null;
    if (dto?.is_active !== undefined) data.is_active = Boolean(dto.is_active);
    if (dto?.is_archived !== undefined) data.is_archived = Boolean(dto.is_archived);
    if (dto?.sort_order !== undefined) data.sort_order = Number(dto.sort_order) || 0;
    if (dto?.group !== undefined) data.group = dto.group ? String(dto.group) : null;
    if (dto?.mode !== undefined) data.mode = dto.mode ? String(dto.mode).toUpperCase() : null;
    if (dto?.basis !== undefined) {
      const basis = String(dto.basis).toUpperCase();
      if (!BASES.includes(basis)) throw new BadRequestException('invalid basis');
      data.basis = basis;
    }
    if (dto?.calculator !== undefined) {
      const calculator = String(dto.calculator).toUpperCase();
      if (!CALCULATORS.includes(calculator)) throw new BadRequestException('invalid calculator');
      data.calculator = calculator;
    }
    // `key` and `section` are intentionally NOT editable — saved costing
    // records are keyed by them, so changing either would orphan stored data.

    return this.prisma.costFieldDefinition.update({ where: { id }, data });
  }

  /** Persist a new order for a section in one call. */
  async reorderFields(ids: string[]) {
    if (!Array.isArray(ids)) throw new BadRequestException('ids must be an array');
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.costFieldDefinition.update({ where: { id }, data: { sort_order: i } }),
      ),
    );
    return { ok: true, count: ids.length };
  }

  /**
   * Archive rather than delete — saved costing records still reference the
   * key, and hard-deleting would silently change historic totals.
   */
  async archiveField(id: string) {
    const existing = await this.prisma.costFieldDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cost field not found');
    return this.prisma.costFieldDefinition.update({
      where: { id },
      data: { is_archived: true, is_active: false },
    });
  }

  // ── Factory cost settings (shop-wide monthly bills) ───────────────────────

  /**
   * The factory's monthly expenses, entered once and reused by every costing.
   *
   * No per-pair figure is derived here: unlike the retail pool this one is
   * shared out per product, against each design's own standard capacity.
   */
  async getFactorySettings() {
    const row = await this.prisma.setting.findUnique({ where: { key: FACTORY_SETTINGS_KEY } });
    const stored = (row?.value ?? null) as Partial<FactoryCostSettings> | null;
    const monthly =
      (stored?.monthly as Record<string, number>) ?? { ...DEFAULT_FACTORY_SETTINGS.monthly };

    const employees: FactoryEmployee[] = Array.isArray(stored?.employees) ? stored!.employees! : [];

    const fields = (await this.listFields()) as unknown as CostFieldLike[];
    const line_pools = Object.fromEntries(
      PRODUCT_LINES.map((line) => [line, calcFactoryLinePool(monthly, fields, employees, line)]),
    ) as Record<ProductLineKey, ReturnType<typeof calcFactoryLinePool>>;

    const finish_man_rates: Record<ProductLineKey, number> = {
      SHOE: finishManRate('SHOE', stored?.finish_man_rates),
      SANDAL: finishManRate('SANDAL', stored?.finish_man_rates),
    };

    return {
      monthly,
      employees,
      finish_man_rates,
      total_monthly: calcFactoryMonthlyTotal(monthly, fields),
      /** The pool a Shoe design and a Sandal design are each costed against. */
      line_pools,
    };
  }

  /**
   * The pool one costing is charged against: its saved line, else a guess from
   * category / name, else the whole team (the original behaviour).
   */
  private async factoryPoolFor(values: Record<string, unknown>, category?: unknown, productName?: unknown) {
    const settings = await this.getFactorySettings();
    const fields = (await this.listFields()) as unknown as CostFieldLike[];
    const line = getLine(values) ?? inferProductLine(category as string, productName as string);
    return calcFactoryLinePool(settings.monthly, fields, settings.employees, line);
  }

  /** Amounts used for fields left empty on a product — today just the finish man's line rate. */
  private async defaultEntriesFor(values: Record<string, unknown>, category?: unknown, productName?: unknown) {
    const settings = await this.getFactorySettings();
    const line = getLine(values) ?? inferProductLine(category as string, productName as string);
    return { [FINISH_MAN_FIELD_KEY]: finishManRate(line, settings.finish_man_rates) };
  }

  /** Validates the employee list sent from Factory Cost Settings. */
  private sanitizeEmployees(raw: unknown): FactoryEmployee[] {
    if (!Array.isArray(raw)) throw new BadRequestException('employees must be a list.');
    return raw.map((e: any, i: number) => {
      const name = String(e?.name ?? '').trim();
      if (!name) throw new BadRequestException(`Employee ${i + 1}: name is required.`);
      const lines = Array.from(new Set((Array.isArray(e?.lines) ? e.lines : []).filter(isProductLine))) as ProductLineKey[];
      if (lines.length === 0) throw new BadRequestException(`${name}: choose Shoe, Sandal, or both.`);
      const salary = num(e?.monthly_salary);
      if (salary < 0) throw new BadRequestException(`${name}: salary can't be negative.`);
      return {
        id: typeof e?.id === 'string' && e.id ? e.id : randomUUID(),
        name,
        role: String(e?.role ?? '').trim() || null,
        monthly_salary: money(salary),
        lines,
        active: e?.active !== false,
      };
    });
  }

  async updateFactorySettings(dto: any) {
    const current = await this.getFactorySettings();
    const monthly: Record<string, number> = { ...current.monthly };
    for (const [k, v] of Object.entries(dto?.monthly ?? {})) {
      if (v === undefined) continue;
      monthly[k] = num(v);
    }

    const employees = dto?.employees !== undefined ? this.sanitizeEmployees(dto.employees) : current.employees;

    // With staff listed, the salary line is the list's total — kept in step so
    // the "Total Monthly Factory Cost" and older readers stay truthful.
    const staff = activeEmployees(employees);
    if (staff.length > 0) {
      monthly[LABOUR_FIELD_KEY] = money(staff.reduce((sum, e) => sum + num(e.monthly_salary), 0));
    }

    // Finish man's per-dozen rate for each line.
    const finish_man_rates: Record<ProductLineKey, number> = { ...current.finish_man_rates };
    for (const line of PRODUCT_LINES) {
      const v = dto?.finish_man_rates?.[line];
      if (v === undefined || v === null || v === '') continue;
      const n = num(v);
      if (n < 0) throw new BadRequestException(`${line} finish rate can't be negative.`);
      finish_man_rates[line] = money(n);
    }

    const next: FactoryCostSettings = { monthly, employees, finish_man_rates };
    await this.prisma.setting.upsert({
      where: { key: FACTORY_SETTINGS_KEY },
      update: { value: next as any },
      create: { key: FACTORY_SETTINGS_KEY, value: next as any },
    });

    return this.getFactorySettings();
  }

  /**
   * What one design's share of the monthly pool works out to.
   * Handy for the settings screen, which previews a few capacities.
   */
  async previewFactoryAllocation(standardCapacityPairs: unknown, line?: unknown) {
    const settings = await this.getFactorySettings();
    const pool = isProductLine(line) ? settings.line_pools[line] : null;
    const total = pool ? pool.total : settings.total_monthly;
    return { total_monthly: total, pool, ...calcFactoryAllocation(total, standardCapacityPairs) };
  }

  // ── Retail cost settings ──────────────────────────────────────────────────

  async getRetailSettings() {
    const row = await this.prisma.setting.findUnique({ where: { key: RETAIL_SETTINGS_KEY } });
    const stored = (row?.value ?? null) as Partial<RetailCostSettings> | null;
    const settings: RetailCostSettings = {
      monthly: (stored?.monthly as Record<string, number>) ?? { ...DEFAULT_RETAIL_SETTINGS.monthly },
      expected_monthly_sales_pairs: num(stored?.expected_monthly_sales_pairs),
    };

    const fields = (await this.listFields()) as unknown as CostFieldLike[];
    const { totalMonthly, perPair } = calcRetailCommonCostPerPair(
      settings.monthly,
      fields,
      settings.expected_monthly_sales_pairs,
    );

    return { ...settings, total_monthly: totalMonthly, retail_common_cost_pair: perPair };
  }

  async updateRetailSettings(dto: any) {
    const current = await this.getRetailSettings();
    const monthly: Record<string, number> = { ...current.monthly };
    for (const [k, v] of Object.entries(dto?.monthly ?? {})) {
      if (v === undefined) continue;
      monthly[k] = num(v);
    }
    const next: RetailCostSettings = {
      monthly,
      expected_monthly_sales_pairs:
        dto?.expected_monthly_sales_pairs !== undefined
          ? num(dto.expected_monthly_sales_pairs)
          : current.expected_monthly_sales_pairs,
    };

    await this.prisma.setting.upsert({
      where: { key: RETAIL_SETTINGS_KEY },
      update: { value: next as any },
      create: { key: RETAIL_SETTINGS_KEY, value: next as any },
    });

    return this.getRetailSettings();
  }

  // ── Product costing records ───────────────────────────────────────────────

  async listCostings() {
    return this.prisma.productCosting.findMany({ orderBy: { updated_at: 'desc' } });
  }

  async getCosting(id: string) {
    const row = await this.prisma.productCosting.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Costing record not found');
    return row;
  }

  /**
   * Recompute every derived figure from the raw inputs.
   *
   * Always done server-side so the stored numbers cannot disagree with the
   * inputs — a browser tab left open on an old field configuration can post
   * stale totals, but it cannot persist them.
   */
  private async computeSnapshot(values: Record<string, unknown>, dto: any, storedCommonPair?: number) {
    const fields = (await this.listFields()) as unknown as CostFieldLike[];
    const retail = await this.getRetailSettings();
    // Only the wages of people on this design's line, plus the shared bills.
    const pool = await this.factoryPoolFor(values, dto?.category, dto?.product_name);
    const defaultEntries = await this.defaultEntriesFor(values, dto?.category, dto?.product_name);

    // An existing record keeps the common cost it was saved with unless the
    // caller explicitly asks to refresh it, so re-opening an old costing does
    // not silently reprice it against this month's rent.
    const commonPair =
      dto?.refresh_retail_common === true || storedCommonPair === undefined
        ? retail.retail_common_cost_pair
        : storedCommonPair;

    // The factory pool deliberately behaves the other way round: it is always
    // read live. That is the point of entering the bills once — a salary rise
    // reaches every product's next save without reopening each one.
    const capacityPairs = num(dto?.standard_capacity_pairs);

    const result = calcCosting({
      values,
      fields,
      standardCapacityPairs: capacityPairs,
      factoryMonthlyTotal: pool.total,
      defaultEntries,
      wholesaleProfitPct: num(dto?.wholesale_profit_pct),
      retailProfitPct: num(dto?.retail_profit_pct),
      retailCommonCostPair: commonPair,
    });

    return {
      retail_common_cost_pair: money(commonPair),
      standard_capacity_pairs: capacityPairs,
      factory_monthly_total: result.factoryMonthlyTotal,
      // Kept in step with the capacity so anything still reading the old
      // column sees a sane figure rather than a stale one.
      monthly_production: money(capacityPairs / PAIRS_PER_DOZEN),
      upper_cost_dozen: result.upperCostDozen,
      sole_cost_dozen: result.soleCostDozen,
      factory_cost_dozen: result.factoryCostDozen,
      production_cost_dozen: result.productionCostDozen,
      production_cost_pair: result.productionCostPair,
      wholesale_profit_pair: result.wholesaleProfitPair,
      wholesale_price_pair: result.wholesalePricePair,
      wholesale_price_dozen: result.wholesalePriceDozen,
      retail_product_cost_pair: result.retailProductCostPair,
      retail_cost_pair: result.retailCostPair,
      retail_profit_pair: result.retailProfitPair,
      retail_price_pair: result.retailPricePair,
      retail_price_dozen: result.retailPriceDozen,
    };
  }

  async createCosting(dto: any) {
    const name = String(dto?.product_name ?? '').trim();
    if (!name) throw new BadRequestException('product_name is required');

    const values = mergeCostValues({}, dto?.values);
    const snapshot = await this.computeSnapshot(values, dto);

    return this.prisma.productCosting.create({
      data: {
        product_id: dto?.product_id ?? null,
        product_name: name,
        product_code: dto?.product_code ?? null,
        category: dto?.category ?? null,
        image_url: dto?.image_url ?? null,
        entry_date: dto?.entry_date ? new Date(dto.entry_date) : new Date(),
        values: values as any,
        wholesale_profit_pct: num(dto?.wholesale_profit_pct),
        retail_profit_pct: num(dto?.retail_profit_pct),
        ...snapshot,
      },
    });
  }

  /**
   * Partial update. Only the keys actually sent are changed:
   * an untouched cost field keeps its stored amount, and a field explicitly
   * set to 0 saves as 0 — the distinction the spec calls out as critical.
   */
  async updateCosting(id: string, dto: any) {
    const existing = await this.getCosting(id);

    const values = mergeCostValues(existing.values as Record<string, unknown>, dto?.values);

    const merged = {
      standard_capacity_pairs:
        dto?.standard_capacity_pairs !== undefined
          ? num(dto.standard_capacity_pairs)
          : existing.standard_capacity_pairs,
      wholesale_profit_pct:
        dto?.wholesale_profit_pct !== undefined ? num(dto.wholesale_profit_pct) : existing.wholesale_profit_pct,
      retail_profit_pct:
        dto?.retail_profit_pct !== undefined ? num(dto.retail_profit_pct) : existing.retail_profit_pct,
      refresh_retail_common: dto?.refresh_retail_common,
      category: dto?.category !== undefined ? dto.category : existing.category,
      product_name: dto?.product_name !== undefined ? dto.product_name : existing.product_name,
    };

    const snapshot = await this.computeSnapshot(values, merged, existing.retail_common_cost_pair);

    return this.prisma.productCosting.update({
      where: { id },
      data: {
        product_id: dto?.product_id !== undefined ? dto.product_id : existing.product_id,
        product_name: dto?.product_name !== undefined ? String(dto.product_name).trim() : existing.product_name,
        product_code: dto?.product_code !== undefined ? dto.product_code : existing.product_code,
        category: dto?.category !== undefined ? dto.category : existing.category,
        image_url: dto?.image_url !== undefined ? dto.image_url : existing.image_url,
        entry_date: dto?.entry_date ? new Date(dto.entry_date) : existing.entry_date,
        values: values as any,
        wholesale_profit_pct: merged.wholesale_profit_pct,
        retail_profit_pct: merged.retail_profit_pct,
        ...snapshot,
      },
    });
  }

  /**
   * Copy an existing costing onto a new product.
   *
   * The whole point is that a new design usually shares most of its build with
   * one already costed — same leather, same sole, a different upper. Copying
   * means the admin edits the three rows that changed instead of retyping
   * forty.
   *
   * Two deliberate choices:
   *   - the catalog link is NOT copied. This is a different product, and
   *     inheriting the old product_id would silently attach two costings to
   *     one catalog item.
   *   - every figure is recomputed rather than copied, so the new record is
   *     priced against today's factory pool, not the one the original was
   *     saved with.
   */
  async duplicateCosting(id: string, dto: any) {
    const source = await this.getCosting(id);

    const name = String(dto?.product_name ?? '').trim();
    if (!name) throw new BadRequestException('A name for the new product costing is required.');

    // Deep-copied through the same merge the form uses, so structured
    // calculator rows arrive intact rather than as a shared reference.
    const values = mergeCostValues({}, source.values as Record<string, unknown>);

    const merged = {
      standard_capacity_pairs:
        dto?.standard_capacity_pairs !== undefined
          ? num(dto.standard_capacity_pairs)
          : (source as any).standard_capacity_pairs,
      wholesale_profit_pct:
        dto?.wholesale_profit_pct !== undefined
          ? num(dto.wholesale_profit_pct)
          : source.wholesale_profit_pct,
      retail_profit_pct:
        dto?.retail_profit_pct !== undefined ? num(dto.retail_profit_pct) : source.retail_profit_pct,
      category: dto?.category !== undefined ? dto.category : source.category,
      product_name: name,
    };

    const snapshot = await this.computeSnapshot(values, merged);

    return this.prisma.productCosting.create({
      data: {
        product_id: dto?.product_id ?? null,
        product_name: name,
        product_code: dto?.product_code !== undefined ? dto.product_code : null,
        category: dto?.category !== undefined ? dto.category : source.category,
        image_url: dto?.image_url !== undefined ? dto.image_url : null,
        entry_date: new Date(),
        values: values as any,
        wholesale_profit_pct: merged.wholesale_profit_pct,
        retail_profit_pct: merged.retail_profit_pct,
        ...snapshot,
      },
    });
  }

  async removeCosting(id: string) {
    await this.getCosting(id);
    return this.prisma.productCosting.delete({ where: { id } });
  }

  /** Live preview for the form — computes without saving anything. */
  async preview(dto: any) {
    const fields = (await this.listFields()) as unknown as CostFieldLike[];
    const retail = await this.getRetailSettings();
    const values = dto?.values ?? {};
    const pool = await this.factoryPoolFor(values, dto?.category, dto?.product_name);
    const defaultEntries = await this.defaultEntriesFor(values, dto?.category, dto?.product_name);
    return calcCosting({
      values,
      fields,
      standardCapacityPairs: num(dto?.standard_capacity_pairs),
      factoryMonthlyTotal: pool.total,
      defaultEntries,
      wholesaleProfitPct: num(dto?.wholesale_profit_pct),
      retailProfitPct: num(dto?.retail_profit_pct),
      retailCommonCostPair:
        dto?.retail_common_cost_pair !== undefined
          ? num(dto.retail_common_cost_pair)
          : retail.retail_common_cost_pair,
    });
  }
}
