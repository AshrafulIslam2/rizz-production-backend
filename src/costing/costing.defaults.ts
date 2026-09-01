import { CostBasisKey, CostCalculatorKey, CostSectionKey } from './costing.calc';

/**
 * Fields created the first time the costing screen is opened.
 *
 * These are a starting point only — every one can be renamed, reordered,
 * disabled or archived from the admin, and new ones added, without touching
 * this file. `key` is what gets stored against each costing record, so it must
 * stay stable even when a label changes.
 *
 * `group` drives the sub-tabs inside Upper and Sole so the admin never faces
 * forty inputs at once. `mode` hides the rows belonging to the option not
 * chosen (handmade vs ready-made).
 */
export type SeedField = {
  key: string;
  label: string;
  section: CostSectionKey;
  basis: CostBasisKey;
  calculator?: CostCalculatorKey;
  group?: string;
  mode?: 'HANDMADE' | 'READYMADE';
  help_text?: string;
};

/** Sub-tab ids, shared with the admin UI. */
export const UPPER_GROUPS = ['materials', 'foam_cover', 'accessories', 'chemicals'] as const;
export const SOLE_GROUPS = ['insole', 'midsole', 'outsole', 'bit', 'tuffy', 'chemicals'] as const;

/** Groups offering a Handmade / Ready Made switch. */
export const MODE_GROUPS = ['insole', 'outsole', 'bit'] as const;

/** The six chemicals costed identically in both Upper and Sole. */
const CHEMICALS = ['Adhesive', 'Primer', 'Solution', 'Alco', 'PU Presting', 'Double PU'] as const;

function chemicalFields(section: CostSectionKey, prefix: string): SeedField[] {
  return CHEMICALS.map((name) => ({
    key: `${prefix}_chem_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    label: name,
    section,
    basis: 'PER_DOZEN' as CostBasisKey,
    calculator: 'CHEMICAL' as CostCalculatorKey,
    group: 'chemicals',
    help_text: 'Container price ÷ container weight × amount used per dozen',
  }));
}

export const DEFAULT_COST_FIELDS: SeedField[] = [
  // ══ UPPER ══════════════════════════════════════════════════════════════
  // Materials
  { key: 'upper_striker', label: 'Striker', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'UNIT', group: 'materials', help_text: 'Pairs required × cost per pair' },
  { key: 'upper_leather', label: 'Upper Leather', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'SQFT', group: 'materials' },
  { key: 'upper_lining', label: 'Lining', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'SQFT', group: 'materials' },

  // Foam & Cover
  { key: 'upper_foam', label: 'Upper Foam', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'UNIT', group: 'foam_cover' },
  { key: 'upper_cover', label: 'Cover', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'UNIT', group: 'foam_cover' },

  // Accessories
  { key: 'upper_tukur', label: 'Tukur', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'accessories' },
  { key: 'upper_reinforcement', label: 'Reinforcement / Backed Material', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'accessories' },
  { key: 'upper_nail_perak', label: 'Nail / Perak', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'accessories' },
  { key: 'upper_thread', label: 'Thread', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'accessories' },
  { key: 'upper_other', label: 'Other Upper Cost', section: 'UPPER', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'accessories' },

  // Chemicals
  ...chemicalFields('UPPER', 'upper'),

  // ══ SOLE ═══════════════════════════════════════════════════════════════
  // Insole — handmade materials or a ready-made price
  { key: 'sole_insole_leather', label: 'Insole Leather', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SQFT', group: 'insole', mode: 'HANDMADE' },
  { key: 'sole_insole_foam', label: 'Insole Foam', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'UNIT', group: 'insole', mode: 'HANDMADE' },
  { key: 'sole_insole_readymade', label: 'Ready Made Insole', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'insole', mode: 'READYMADE', help_text: 'Price per dozen' },

  // Midsole — all sheet-based
  { key: 'sole_texon', label: 'Texon Board', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'midsole' },
  { key: 'sole_srs', label: 'SRS', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'midsole' },
  { key: 'sole_eva', label: 'EVA Rubber', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'midsole' },

  // Outsole
  { key: 'sole_outsole_sheet', label: 'Sole Sheet', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'outsole', mode: 'HANDMADE', help_text: 'Crepe / Brush-off / Rubber — sheet price ÷ pairs per sheet' },
  { key: 'sole_outsole_readymade', label: 'Ready Made Sole', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'DIRECT', group: 'outsole', mode: 'READYMADE', help_text: 'Price per dozen' },

  // Bit
  { key: 'sole_bit_sheet', label: 'Bit Sheet', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'bit', mode: 'HANDMADE' },
  { key: 'sole_bit_readymade', label: 'Ready Made Bit', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'UNIT', group: 'bit', mode: 'READYMADE', help_text: 'Quantity (goj/yard) × cost per unit' },

  // Tuffy
  { key: 'sole_tuffy', label: 'Tuffy', section: 'SOLE', basis: 'PER_DOZEN', calculator: 'SHEET', group: 'tuffy' },

  // Sole chemicals
  ...chemicalFields('SOLE', 'sole'),

  // ══ FACTORY ════════════════════════════════════════════════════════════
  // Labour is priced per dozen; building bills arrive monthly and are spread
  // across the month's output.
  { key: 'factory_labour', label: 'Factory Labour', section: 'FACTORY', basis: 'PER_DOZEN', calculator: 'DIRECT' },
  { key: 'factory_rent', label: 'Factory Rent', section: 'FACTORY', basis: 'PER_MONTH', calculator: 'DIRECT', help_text: 'Monthly bill — divided by monthly production' },
  { key: 'factory_electricity', label: 'Electricity', section: 'FACTORY', basis: 'PER_MONTH', calculator: 'DIRECT', help_text: 'Monthly bill — divided by monthly production' },
  { key: 'factory_machine_maintenance', label: 'Machinery Maintenance', section: 'FACTORY', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'factory_machine_depreciation', label: 'Machinery Depreciation', section: 'FACTORY', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'factory_packaging', label: 'Factory Packaging', section: 'FACTORY', basis: 'PER_DOZEN', calculator: 'DIRECT' },
  { key: 'factory_transport', label: 'Factory Transport', section: 'FACTORY', basis: 'PER_DOZEN', calculator: 'DIRECT' },
  { key: 'factory_other', label: 'Other Factory Expenses', section: 'FACTORY', basis: 'PER_MONTH', calculator: 'DIRECT' },

  // ══ RETAIL COMMON (monthly shop expenses) ══════════════════════════════
  { key: 'retail_shop_rent', label: 'Shop Rent', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_employee', label: 'Showroom Employee Cost', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_electricity', label: 'Showroom Electricity', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_decoration', label: 'Shop Decoration Depreciation', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_pos_software', label: 'POS / Software Cost', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_marketing', label: 'Retail Marketing', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_internet', label: 'Internet / Telephone', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_delivery', label: 'Delivery / Logistics', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },
  { key: 'retail_other', label: 'Other Retail Expenses', section: 'RETAIL_COMMON', basis: 'PER_MONTH', calculator: 'DIRECT' },

  // ══ RETAIL PRODUCT-SPECIFIC (already per pair) ═════════════════════════
  { key: 'retail_product_box', label: 'Product Box', section: 'RETAIL_PRODUCT', basis: 'PER_PAIR', calculator: 'DIRECT' },
  { key: 'retail_special_packaging', label: 'Special Packaging', section: 'RETAIL_PRODUCT', basis: 'PER_PAIR', calculator: 'DIRECT' },
  { key: 'retail_shopping_bag', label: 'Shopping Bag', section: 'RETAIL_PRODUCT', basis: 'PER_PAIR', calculator: 'DIRECT' },
  { key: 'retail_product_other', label: 'Other Product-Specific Cost', section: 'RETAIL_PRODUCT', basis: 'PER_PAIR', calculator: 'DIRECT' },
];

// ── Seed versioning ────────────────────────────────────────────────────────
//
// The first release seeded a flat list of Upper/Sole fields. Bumping this
// number makes the service upgrade an already-seeded database to the
// structured set above: shared keys are updated in place (keeping any saved
// amount), new keys are created, and the flat leftovers are archived.
//
// Bump it again whenever DEFAULT_COST_FIELDS changes in a way existing
// installations need to pick up.

/** Key of the Setting row remembering which seed version has been applied. */
export const FIELD_SEED_VERSION_KEY = 'cost_fields_seed_version';

/** 1 = flat Upper/Sole list. 2 = structured groups with calculators. */
export const FIELD_SEED_VERSION = 2;

/** Every Upper/Sole key the v1 seed created. */
export const V1_UPPER_SOLE_KEYS: string[] = [
  'upper_leather_used',
  'upper_leather_cost',
  'upper_lining_used',
  'upper_lining_cost',
  'upper_foam',
  'upper_thread',
  'upper_solution',
  'upper_adhesive',
  'upper_color_coat',
  'upper_other',
  'sole_fiber',
  'sole_hd_foam',
  'sole_eva',
  'sole_texon',
  'sole_srs_board',
  'sole_ready_fiber',
  'sole_sole',
  'sole_bit',
  'sole_adhesive',
  'sole_primer',
  'sole_thread',
  'sole_color',
  'sole_other',
];

/**
 * Labels the v1 seed wrote, for the keys v2 reuses.
 *
 * The upgrade refreshes a label only when it still matches what was seeded —
 * so an admin who renamed a field keeps their wording.
 */
export const V1_SEED_LABELS: Record<string, string> = {
  upper_foam: 'Foam',
  upper_thread: 'Thread',
  upper_other: 'Other Upper Cost',
  sole_eva: 'EVA',
  sole_texon: 'Texon',
};

/** Key of the Setting row holding shop-wide retail costing settings. */
export const RETAIL_SETTINGS_KEY = 'retail_cost_settings';

export type RetailCostSettings = {
  /** fieldKey -> monthly amount for RETAIL_COMMON fields. */
  monthly: Record<string, number>;
  /** Pairs the shop expects to sell per month. */
  expected_monthly_sales_pairs: number;
};

export const DEFAULT_RETAIL_SETTINGS: RetailCostSettings = {
  monthly: {},
  expected_monthly_sales_pairs: 0,
};
