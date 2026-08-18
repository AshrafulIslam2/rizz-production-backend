/**
 * Shop (POS) statistics.
 *
 * Kept separate from `stats.service.ts`, which reports on ONLINE orders. This
 * one only ever looks at PosTransaction rows — the counter sales.
 *
 * Profit note: a POS transaction stores its line items as a JSON snapshot that
 * has the selling price but not the cost, so cost is recovered by joining each
 * item's `variant_id` back to ProductVariant.production_price. Variants with no
 * production_price set contribute revenue but no profit, and are counted in
 * `itemsMissingCost` so the UI can be honest that the profit figure is partial
 * rather than quietly reporting it as complete.
 */

export type ShopStatsRange = { from?: Date; to?: Date };

type PosItem = {
  variant_id?: string;
  name?: string;
  color?: string;
  size?: string;
  price?: number;
  original_price?: number;
  qty?: number;
};

function dayKey(d: Date): string {
  // Local calendar day, not UTC — a 9pm Dhaka sale belongs to that day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildShopStats(
  txs: Array<{
    id: string;
    tx_number: string;
    created_at: Date;
    status: string;
    items: unknown;
    subtotal: number;
    discount_amount: number;
    total: number;
    payment_cash: number;
    payment_card: number;
    payment_mobile: number;
    customer_name: string | null;
    customer_phone: string | null;
  }>,
  variantCost: Map<string, number | null>,
) {
  const completed = txs.filter((t) => t.status !== 'draft');

  let totalRevenue = 0;
  let totalCost = 0;
  let totalItems = 0;
  let totalDiscount = 0;
  let itemsMissingCost = 0;
  let itemsWithCost = 0;

  const daily = new Map<string, { date: string; sales: number; revenue: number; profit: number; items: number }>();
  const productMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  const customerMap = new Map<
    string,
    { name: string; phone: string; purchases: number; value: number; lastPurchase: Date }
  >();
  const hourly = new Array(24).fill(0).map((_, h) => ({ hour: h, sales: 0, revenue: 0 }));

  for (const tx of completed) {
    totalRevenue += tx.total;
    totalDiscount += tx.discount_amount ?? 0;

    const key = dayKey(tx.created_at);
    const dayRow = daily.get(key) ?? { date: key, sales: 0, revenue: 0, profit: 0, items: 0 };
    dayRow.sales += 1;
    dayRow.revenue += tx.total;

    const h = tx.created_at.getHours();
    hourly[h].sales += 1;
    hourly[h].revenue += tx.total;

    const items: PosItem[] = Array.isArray(tx.items) ? (tx.items as PosItem[]) : [];
    for (const item of items) {
      const qty = Number(item?.qty) || 0;
      const price = Number(item?.price) || 0;
      if (qty <= 0) continue;

      const revenue = price * qty;
      totalItems += qty;
      dayRow.items += qty;

      const cost = item?.variant_id ? variantCost.get(item.variant_id) ?? null : null;
      let profit = 0;
      if (cost != null) {
        profit = (price - cost) * qty;
        totalCost += cost * qty;
        itemsWithCost += qty;
      } else {
        itemsMissingCost += qty;
      }
      dayRow.profit += profit;

      const pName = item?.name ?? 'Unknown';
      const prod = productMap.get(pName) ?? { name: pName, qty: 0, revenue: 0, profit: 0 };
      prod.qty += qty;
      prod.revenue += revenue;
      prod.profit += profit;
      productMap.set(pName, prod);
    }

    daily.set(key, dayRow);

    // Only sales that actually carry a customer identity are tracked; walk-ins
    // with no name or phone would otherwise all collapse into one fake person.
    const custKey = (tx.customer_phone || '').trim() || (tx.customer_name || '').trim();
    if (custKey) {
      const c = customerMap.get(custKey) ?? {
        name: tx.customer_name || '—',
        phone: tx.customer_phone || '',
        purchases: 0,
        value: 0,
        lastPurchase: tx.created_at,
      };
      c.purchases += 1;
      c.value += tx.total;
      if (tx.created_at > c.lastPurchase) c.lastPurchase = tx.created_at;
      if (!c.name || c.name === '—') c.name = tx.customer_name || c.name;
      customerMap.set(custKey, c);
    }
  }

  const totalSales = completed.length;
  // Profit is only meaningful across the items whose cost is known, so it is
  // reported against the revenue of those items rather than all revenue.
  const grossProfit = completed.reduce((sum, tx) => {
    const items: PosItem[] = Array.isArray(tx.items) ? (tx.items as PosItem[]) : [];
    return (
      sum +
      items.reduce((s, item) => {
        const qty = Number(item?.qty) || 0;
        const price = Number(item?.price) || 0;
        const cost = item?.variant_id ? variantCost.get(item.variant_id) ?? null : null;
        return cost != null ? s + (price - cost) * qty : s;
      }, 0)
    );
  }, 0);

  const dailyData = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    summary: {
      totalSales,
      totalRevenue: Math.round(totalRevenue),
      totalProfit: Math.round(grossProfit),
      totalCost: Math.round(totalCost),
      totalItems,
      totalDiscount: Math.round(totalDiscount),
      avgSaleValue: totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0,
      avgItemsPerSale: totalSales > 0 ? +(totalItems / totalSales).toFixed(1) : 0,
      profitMargin: totalRevenue > 0 ? +((grossProfit / totalRevenue) * 100).toFixed(1) : 0,
      // Transparency about how complete the profit number is.
      itemsWithCost,
      itemsMissingCost,
      costCoverage:
        itemsWithCost + itemsMissingCost > 0
          ? +((itemsWithCost / (itemsWithCost + itemsMissingCost)) * 100).toFixed(0)
          : 100,
    },
    dailyData,
    hourlyData: hourly,
    payments: {
      cash: Math.round(completed.reduce((s, t) => s + (t.payment_cash ?? 0), 0)),
      card: Math.round(completed.reduce((s, t) => s + (t.payment_card ?? 0), 0)),
      mobile: Math.round(completed.reduce((s, t) => s + (t.payment_mobile ?? 0), 0)),
    },
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15)
      .map((p) => ({ ...p, revenue: Math.round(p.revenue), profit: Math.round(p.profit) })),
    topCustomers: Array.from(customerMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
      .map((c) => ({ ...c, value: Math.round(c.value), lastPurchase: c.lastPurchase.toISOString() })),
    recentSales: completed
      .slice()
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 20)
      .map((t) => ({
        tx_number: t.tx_number,
        created_at: t.created_at.toISOString(),
        customer_name: t.customer_name,
        total: Math.round(t.total),
        items: Array.isArray(t.items) ? (t.items as PosItem[]).reduce((s, i) => s + (Number(i?.qty) || 0), 0) : 0,
      })),
  };
}
