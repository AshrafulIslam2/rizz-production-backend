import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcCosting,
  calcRetailCommonCostPerPair,
  mergeCostValues,
  money,
  num,
  CostFieldLike,
} from './costing.calc';
import {
  DEFAULT_COST_FIELDS,
  DEFAULT_RETAIL_SETTINGS,
  FIELD_SEED_VERSION,
  FIELD_SEED_VERSION_KEY,
  V1_SEED_LABELS,
  V1_UPPER_SOLE_KEYS,
  RETAIL_SETTINGS_KEY,
  RetailCostSettings,
} from './costing.defaults';

const SECTIONS = ['UPPER', 'SOLE', 'FACTORY', 'RETAIL_COMMON', 'RETAIL_PRODUCT'];
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
  private async syncDefaultFields(): Promise<void> {
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

      // Only refresh the label when it still reads exactly as the version that
      // seeded it — an admin rename always wins.
      const seededLabel = V1_SEED_LABELS[f.key];
      const renamed = seededLabel !== undefined && current.label !== seededLabel;
      const label = renamed ? current.label : f.label;

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
            // A field the upgrade re-introduces must come back into the form.
            is_archived: false,
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
      await this.syncDefaultFields();
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

    // An existing record keeps the common cost it was saved with unless the
    // caller explicitly asks to refresh it, so re-opening an old costing does
    // not silently reprice it against this month's rent.
    const commonPair =
      dto?.refresh_retail_common === true || storedCommonPair === undefined
        ? retail.retail_common_cost_pair
        : storedCommonPair;

    const result = calcCosting({
      values,
      fields,
      monthlyProductionDozen: num(dto?.monthly_production),
      wholesaleProfitPct: num(dto?.wholesale_profit_pct),
      retailProfitPct: num(dto?.retail_profit_pct),
      retailCommonCostPair: commonPair,
    });

    return {
      retail_common_cost_pair: money(commonPair),
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
        monthly_production: num(dto?.monthly_production),
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
      monthly_production:
        dto?.monthly_production !== undefined ? num(dto.monthly_production) : existing.monthly_production,
      wholesale_profit_pct:
        dto?.wholesale_profit_pct !== undefined ? num(dto.wholesale_profit_pct) : existing.wholesale_profit_pct,
      retail_profit_pct:
        dto?.retail_profit_pct !== undefined ? num(dto.retail_profit_pct) : existing.retail_profit_pct,
      refresh_retail_common: dto?.refresh_retail_common,
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
        monthly_production: merged.monthly_production,
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
    return calcCosting({
      values: dto?.values ?? {},
      fields,
      monthlyProductionDozen: num(dto?.monthly_production),
      wholesaleProfitPct: num(dto?.wholesale_profit_pct),
      retailProfitPct: num(dto?.retail_profit_pct),
      retailCommonCostPair:
        dto?.retail_common_cost_pair !== undefined
          ? num(dto.retail_common_cost_pair)
          : retail.retail_common_cost_pair,
    });
  }
}
