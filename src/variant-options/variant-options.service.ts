import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The list of sizes and colours offered when creating a product variant.
 *
 * Stored in the generic `Setting` key/value table rather than a table of its
 * own, so adding this feature needs no Prisma migration — the same approach
 * branding / delivery-settings / policies already use.
 */
const SETTING_KEY = 'variant_options';

/** Seeded from the values that used to be hardcoded in the admin UI. */
const DEFAULTS: VariantOptions = {
  sizes: ['39', '40', '41', '42', '43', '44', '45'],
  colors: ['Tan', 'Brown', 'Black', 'Dark Brown', 'Cognac', 'Oxblood'],
};

export type VariantOptions = { sizes: string[]; colors: string[] };

/** Trim, drop blanks, and remove case-insensitive duplicates while keeping order. */
function clean(values: unknown, field: string): string[] {
  if (!Array.isArray(values)) {
    throw new BadRequestException(`"${field}" must be an array of strings`);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const v = raw.trim();
    if (!v) continue;
    if (v.length > 40) {
      throw new BadRequestException(`"${v}" is too long for ${field} (max 40 characters)`);
    }
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

@Injectable()
export class VariantOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<VariantOptions> {
    const setting = await this.prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const stored = (setting?.value ?? null) as Partial<VariantOptions> | null;
    if (!stored) return { ...DEFAULTS };
    return {
      sizes: Array.isArray(stored.sizes) ? clean(stored.sizes, 'sizes') : [...DEFAULTS.sizes],
      colors: Array.isArray(stored.colors) ? clean(stored.colors, 'colors') : [...DEFAULTS.colors],
    };
  }

  /**
   * Replaces the whole list. The admin page always sends the full set, so this
   * covers add, rename, reorder and delete in one call.
   */
  async update(data: Partial<VariantOptions>): Promise<VariantOptions> {
    const current = await this.get();
    const next: VariantOptions = {
      sizes: data.sizes !== undefined ? clean(data.sizes, 'sizes') : current.sizes,
      colors: data.colors !== undefined ? clean(data.colors, 'colors') : current.colors,
    };
    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: next },
      create: { key: SETTING_KEY, value: next },
    });
    return next;
  }

  /**
   * The saved list plus every size/colour already present on a real variant.
   *
   * Without this, a value used by an existing product but missing from the
   * saved list would silently vanish from that variant's dropdown and the row
   * would appear to change size/colour on the next save.
   */
  async getWithUsed(): Promise<VariantOptions & { usedSizes: string[]; usedColors: string[] }> {
    const [saved, variants] = await Promise.all([
      this.get(),
      this.prisma.productVariant.findMany({ select: { attributes: true } }),
    ]);

    const usedSizes = new Set<string>();
    const usedColors = new Set<string>();
    for (const v of variants) {
      const attrs = (v.attributes ?? {}) as { size?: unknown; color?: unknown };
      if (typeof attrs.size === 'string' && attrs.size.trim()) usedSizes.add(attrs.size.trim());
      if (typeof attrs.color === 'string' && attrs.color.trim()) usedColors.add(attrs.color.trim());
    }

    const merge = (list: string[], used: Set<string>) => {
      const have = new Set(list.map((s) => s.toLowerCase()));
      const extra = [...used].filter((u) => !have.has(u.toLowerCase())).sort();
      return [...list, ...extra];
    };

    return {
      sizes: merge(saved.sizes, usedSizes),
      colors: merge(saved.colors, usedColors),
      usedSizes: [...usedSizes],
      usedColors: [...usedColors],
    };
  }
}
