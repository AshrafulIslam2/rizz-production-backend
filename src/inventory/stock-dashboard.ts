type VariantInput = {
  id: string; sku: string; variant_name: string; attributes: unknown;
  stock_qty: number; reserved_qty: number; price: number;
  sale_price: number | null; production_price: number | null;
};
type ProductInput = {
  id: string; name: string; slug: string; variants: VariantInput[];
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Physical inventory is valued once, including units held for online orders. */
export function buildStockDashboard(input: ProductInput[], threshold = 10) {
  const products = input.map((product) => {
    const variants = product.variants.map((v) => {
      const available_qty = Math.max(0, v.stock_qty - v.reserved_qty);
      const selling_price = v.sale_price ?? v.price;
      return {
        ...v, available_qty, selling_price,
        selling_value: round(selling_price * v.stock_qty),
        production_value: v.production_price === null ? null : round(v.production_price * v.stock_qty),
        cost_missing: v.production_price === null,
        low_stock: available_qty < threshold,
      };
    });
    return {
      id: product.id, name: product.name, slug: product.slug, variants,
      totalQty: variants.reduce((sum, v) => sum + v.stock_qty, 0),
      totalReserved: variants.reduce((sum, v) => sum + v.reserved_qty, 0),
      totalAvailable: variants.reduce((sum, v) => sum + v.available_qty, 0),
      totalValue: round(variants.reduce((sum, v) => sum + v.selling_value, 0)),
      totalCost: round(variants.reduce((sum, v) => sum + (v.production_value ?? 0), 0)),
      missingCostVariants: variants.filter((v) => v.cost_missing).length,
      missingCostQty: variants.filter((v) => v.cost_missing).reduce((sum, v) => sum + v.stock_qty, 0),
      lowStockVariants: variants.filter((v) => v.low_stock).length,
    };
  });
  const all = products.flatMap((p) => p.variants);
  return {
    generatedAt: new Date().toISOString(), threshold, products,
    summary: {
      totalProducts: products.length, totalVariants: all.length,
      totalQty: all.reduce((sum, v) => sum + v.stock_qty, 0),
      totalReserved: all.reduce((sum, v) => sum + v.reserved_qty, 0),
      totalAvailable: all.reduce((sum, v) => sum + v.available_qty, 0),
      totalValue: round(all.reduce((sum, v) => sum + v.selling_value, 0)),
      totalCost: round(all.reduce((sum, v) => sum + (v.production_value ?? 0), 0)),
      missingCostVariants: all.filter((v) => v.cost_missing).length,
      missingCostQty: all.filter((v) => v.cost_missing).reduce((sum, v) => sum + v.stock_qty, 0),
      lowStockVariants: all.filter((v) => v.low_stock).length,
      // A product is flagged when at least one of its variants is low.
      lowStockProducts: products.filter((p) => p.lowStockVariants > 0).length,
      outOfStock: all.filter((v) => v.available_qty === 0).length,
      productsWithoutVariants: products.filter((p) => p.variants.length === 0).length,
    },
  };
}
