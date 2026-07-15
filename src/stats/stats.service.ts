import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(from?: Date, to?: Date) {
    const where: any = {};
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    const [orders, products, variants] = await Promise.all([
      this.prisma.order.findMany({ where }),
      this.prisma.product.findMany({
        select: { id: true, name: true, slug: true, sku: true, status: true, media: { where: { is_primary: true }, take: 1 } },
      }),
      this.prisma.productVariant.findMany({
        select: { id: true, product_id: true, sku: true, price: true, production_price: true, stock_qty: true, attributes: true },
      }),
    ]);

    // ── variant maps ──────────────────────────────────────────────────────────
    const variantBySlugSizeColor = new Map<string, { production_price: number | null; price: number }>();
    const variantByProductId = new Map<string, typeof variants>();
    const productBySlug = new Map<string, typeof products[0]>();

    for (const p of products) {
      productBySlug.set(p.slug, p);
    }
    for (const v of variants) {
      const product = products.find((p) => p.id === v.product_id);
      if (product) {
        const size = String((v.attributes as any)?.size ?? '');
        const color = String((v.attributes as any)?.color ?? '');
        variantBySlugSizeColor.set(`${product.slug}|${size}|${color}`, v);
      }
      if (!variantByProductId.has(v.product_id)) variantByProductId.set(v.product_id, []);
      variantByProductId.get(v.product_id)!.push(v);
    }

    // ── order aggregation ─────────────────────────────────────────────────────
    const delivered = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const pending = orders.filter((o) => o.status === 'pending');

    let totalRevenue = 0;
    let totalCost = 0;
    const productSalesMap = new Map<string, { qty: number; revenue: number; profit: number; name: string; slug: string; sku: string; image: string }>();
    const customerMap = new Map<string, { name: string; phone: string; email: string; orders: number; value: number; cancelled: number; cancelledValue: number; lastOrder: Date }>();

    for (const order of orders) {
      const key = order.customer_phone || order.customer_email || order.customer_name;
      const existing = customerMap.get(key) ?? { name: order.customer_name, phone: order.customer_phone, email: order.customer_email ?? '', orders: 0, value: 0, cancelled: 0, cancelledValue: 0, lastOrder: order.created_at };
      existing.orders += 1;
      if (order.status === 'cancelled') { existing.cancelled += 1; existing.cancelledValue += order.total; }
      else { existing.value += order.total; }
      if (order.created_at > existing.lastOrder) existing.lastOrder = order.created_at;
      customerMap.set(key, existing);
    }

    for (const order of delivered) {
      totalRevenue += order.total;
      const items: any[] = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const qty = Number(item?.quantity) || 1;
        const itemPrice = Number(item?.price) || 0;
        const vKey = `${item?.slug}|${String(item?.size ?? '')}|${String(item?.color ?? '')}`;
        const variant = variantBySlugSizeColor.get(vKey);
        const prodCost = variant?.production_price ?? null;
        const revenue = itemPrice * qty;
        const profit = prodCost != null ? (itemPrice - prodCost) * qty : 0;
        if (prodCost != null) totalCost += prodCost * qty;

        const product = productBySlug.get(item?.slug ?? '');
        if (product) {
          const existing = productSalesMap.get(product.id) ?? {
            qty: 0, revenue: 0, profit: 0,
            name: product.name ?? '', slug: product.slug, sku: product.sku ?? '',
            image: (product.media?.[0] as any)?.media_url ?? '',
          };
          existing.qty += qty;
          existing.revenue += revenue;
          existing.profit += profit;
          productSalesMap.set(product.id, existing);
        }
      }
    }

    // ── stock analytics ───────────────────────────────────────────────────────
    const totalStockQty = variants.reduce((s, v) => s + v.stock_qty, 0);
    const totalStockValue = variants.reduce((s, v) => s + v.price * v.stock_qty, 0);
    const totalPurchaseCost = variants.reduce((s, v) => s + (v.production_price ?? 0) * v.stock_qty, 0);

    // low stock: < 5, out of stock: 0
    const lowStockProducts = products
      .map((p) => {
        const pvs = variantByProductId.get(p.id) ?? [];
        const totalStock = pvs.reduce((s, v) => s + v.stock_qty, 0);
        return { id: p.id, name: p.name, slug: p.slug, image: (p.media?.[0] as any)?.media_url ?? '', totalStock };
      })
      .filter((p) => p.totalStock < 5 && p.totalStock > 0)
      .sort((a, b) => a.totalStock - b.totalStock)
      .slice(0, 10);

    const outOfStockProducts = products
      .map((p) => {
        const pvs = variantByProductId.get(p.id) ?? [];
        const totalStock = pvs.reduce((s, v) => s + v.stock_qty, 0);
        return { id: p.id, name: p.name, slug: p.slug, image: (p.media?.[0] as any)?.media_url ?? '', totalStock };
      })
      .filter((p) => p.totalStock === 0);

    // ── monthly breakdown (all time) ──────────────────────────────────────────
    const monthlyMap = new Map<string, { revenue: number; orders: number; profit: number; cost: number }>();
    for (const order of orders) {
      const label = order.created_at.toISOString().slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(label) ?? { revenue: 0, orders: 0, profit: 0, cost: 0 };
      entry.orders += 1;
      if (order.status === 'delivered') {
        entry.revenue += order.total;
        const items: any[] = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const qty = Number(item?.quantity) || 1;
          const itemPrice = Number(item?.price) || 0;
          const vKey = `${item?.slug}|${String(item?.size ?? '')}|${String(item?.color ?? '')}`;
          const variant = variantBySlugSizeColor.get(vKey);
          const prodCost = variant?.production_price ?? null;
          if (prodCost != null) {
            entry.cost += prodCost * qty;
            entry.profit += (itemPrice - prodCost) * qty;
          }
        }
      }
      monthlyMap.set(label, entry);
    }

    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ── yearly breakdown ──────────────────────────────────────────────────────
    const yearlyMap = new Map<string, { revenue: number; orders: number; profit: number }>();
    for (const m of monthlyData) {
      const year = m.month.slice(0, 4);
      const entry = yearlyMap.get(year) ?? { revenue: 0, orders: 0, profit: 0 };
      entry.revenue += m.revenue;
      entry.orders += m.orders;
      entry.profit += m.profit;
      yearlyMap.set(year, entry);
    }
    const yearlyData = Array.from(yearlyMap.entries())
      .map(([year, d]) => ({ year, ...d }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // ── product rankings ──────────────────────────────────────────────────────
    const productRankings = Array.from(productSalesMap.values()).sort((a, b) => b.qty - a.qty);

    // ── customer rankings ─────────────────────────────────────────────────────
    const customers = Array.from(customerMap.values());
    const topByOrders = [...customers].sort((a, b) => b.orders - a.orders).slice(0, 20);
    const topByValue = [...customers].sort((a, b) => b.value - a.value).slice(0, 20);
    const topByCancelled = [...customers].filter((c) => c.cancelled > 0).sort((a, b) => b.cancelled - a.cancelled).slice(0, 20);

    const totalProfit = totalRevenue - totalCost;

    return {
      summary: {
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalStockQty,
        totalStockValue,
        totalPurchaseCost,
        totalDelivered: delivered.length,
        totalCancelled: cancelled.length,
        totalPending: pending.length,
        totalProfit,
        totalCost,
        profitMargin: totalRevenue > 0 ? +((totalProfit / totalRevenue) * 100).toFixed(1) : 0,
      },
      monthlyData,
      yearlyData,
      productRankings,
      lowStockProducts,
      outOfStockProducts,
      customers: { topByOrders, topByValue, topByCancelled },
    };
  }
}
