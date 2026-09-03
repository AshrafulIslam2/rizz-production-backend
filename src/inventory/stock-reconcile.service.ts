import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STATUS_LABEL, statusOf } from '../orders/order-status';
import {
  LEGACY_STATE_AT_CREATION,
  quantitiesByVariant,
  stockDelta,
  targetStockState,
  variantKey,
} from '../orders/order-stock';

/** Setting key remembering that the one-time reconciliation has run. */
const MIGRATION_KEY = 'inventory_order_stock_migration_v1';

/**
 * One-time repair of the damage done by the old "deduct on create" behaviour.
 *
 * Every order ever placed decremented stock the moment its row was written,
 * whatever became of it afterwards. Fake orders, cancelled orders and orders
 * still sitting unverified have therefore all eaten real inventory that was
 * never given back.
 *
 * This walks every order, works out what it SHOULD be holding under the new
 * rules, and applies the difference — writing an InventoryMovement row for
 * every change so the whole repair is auditable and reversible by inspection.
 *
 * Three deliberate safety properties:
 *
 *   1. It refuses to run twice. Running it again after the shelf has been
 *      counted by hand would add the same units a second time, which is the
 *      one way this could do real harm.
 *   2. `audit()` computes the entire plan without writing anything, so the
 *      numbers can be checked against the shelf before committing.
 *   3. Delivered orders are left exactly as they are — their stock was
 *      correctly deducted and must stay deducted.
 */
@Injectable()
export class StockReconcileService {
  constructor(private readonly prisma: PrismaService) {}

  private async marker() {
    const row = await this.prisma.setting.findUnique({ where: { key: MIGRATION_KEY } });
    return (row?.value ?? null) as { done?: boolean; at?: string; summary?: unknown } | null;
  }

  /**
   * Work out every change without making any.
   *
   * Returns per-variant totals so the figures can be compared with a physical
   * count before anything is written.
   */
  async audit() {
    const [orders, variants, products] = await Promise.all([
      this.prisma.order.findMany({
        select: {
          id: true, order_number: true, status: true, items: true,
          stock_state: true, created_at: true,
        } as any,
      }),
      this.prisma.productVariant.findMany({
        select: { id: true, product_id: true, sku: true, stock_qty: true, attributes: true } as any,
      }),
      this.prisma.product.findMany({ select: { id: true, slug: true, name: true } }),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const byKey = new Map<string, any>();
    const singleVariantProduct = new Map<string, any[]>();
    for (const v of variants as any[]) {
      const product = productById.get(v.product_id);
      if (!product) continue;
      const size = String((v.attributes as any)?.size ?? '');
      const color = String((v.attributes as any)?.color ?? '');
      byKey.set(variantKey(product.slug, size, color), { ...v, slug: product.slug, name: product.name });
      const list = singleVariantProduct.get(product.slug) ?? [];
      list.push({ ...v, slug: product.slug, name: product.name });
      singleVariantProduct.set(product.slug, list);
    }

    /** variantId -> units to add back (positive) or remove (negative). */
    const change = new Map<string, { variant: any; stock: number; reserved: number; orders: string[] }>();
    const byStatus: Record<string, number> = {};
    let ordersAffected = 0;
    let unmatchedLines = 0;

    for (const order of orders as any[]) {
      const status = statusOf(order.status);
      // Historic rows all deducted at creation. A row already carrying a
      // stock_state has been through the new code and must not be touched.
      const from = order.stock_state ? undefined : LEGACY_STATE_AT_CREATION;
      if (from === undefined) continue;

      const to = targetStockState(status);
      const delta = stockDelta(from, to);
      if (delta.stock === 0 && delta.reserved === 0) continue;

      const items: any[] = Array.isArray(order.items) ? order.items : [];
      const quantities = quantitiesByVariant(items);
      let touched = false;

      for (const [key, qty] of quantities.entries()) {
        const [slug, size, color] = key.split('|');
        let variant = byKey.get(key);
        if (!variant) {
          const list = singleVariantProduct.get(slug) ?? [];
          variant = list.length === 1 ? list[0] : undefined;
        }
        if (!variant) { unmatchedLines += 1; continue; }

        const entry = change.get(variant.id) ?? { variant, stock: 0, reserved: 0, orders: [] };
        entry.stock += delta.stock * qty;
        entry.reserved += delta.reserved * qty;
        if (!entry.orders.includes(order.order_number)) entry.orders.push(order.order_number);
        change.set(variant.id, entry);
        touched = true;
        void size; void color;
      }

      if (touched) {
        ordersAffected += 1;
        byStatus[status] = (byStatus[status] ?? 0) + 1;
      }
    }

    const rows = Array.from(change.values())
      .filter((c) => c.stock !== 0 || c.reserved !== 0)
      .map((c) => ({
        variant_id: c.variant.id,
        product: c.variant.name,
        sku: c.variant.sku,
        size: String((c.variant.attributes as any)?.size ?? ''),
        color: String((c.variant.attributes as any)?.color ?? ''),
        current_stock: c.variant.stock_qty,
        stock_change: c.stock,
        new_stock: Math.max(0, c.variant.stock_qty + c.stock),
        reserved_change: c.reserved,
        order_count: c.orders.length,
        orders: c.orders.slice(0, 20),
      }))
      .sort((a, b) => Math.abs(b.stock_change) - Math.abs(a.stock_change));

    const marker = await this.marker();
    return {
      already_run: Boolean(marker?.done),
      ran_at: marker?.at ?? null,
      orders_affected: ordersAffected,
      orders_by_status: Object.fromEntries(
        Object.entries(byStatus).map(([k, v]) => [ORDER_STATUS_LABEL[k as never] ?? k, v]),
      ),
      units_to_restore: rows.reduce((t, r) => t + Math.max(0, r.stock_change), 0),
      units_to_remove: rows.reduce((t, r) => t + Math.max(0, -r.stock_change), 0),
      variants_affected: rows.length,
      unmatched_lines: unmatchedLines,
      rows,
    };
  }

  /**
   * Apply the plan from `audit()`.
   *
   * Refuses if it has run before — see the class comment. Pass
   * `force: true` only if you genuinely intend to apply it a second time and
   * have checked the shelf; there is no way for the code to know that.
   */
  async apply(opts: { force?: boolean; actor?: string } = {}) {
    const marker = await this.marker();
    if (marker?.done && !opts.force) {
      throw new BadRequestException(
        `Stock reconciliation already ran on ${marker.at}. Running it again would add the same units a second time. ` +
        `If you are certain, pass force=true — but count the shelf first.`,
      );
    }

    const plan = await this.audit();
    const actor = opts.actor ?? 'admin';

    await this.prisma.$transaction(async (tx) => {
      for (const row of plan.rows) {
        const variant = await tx.productVariant.findUnique({ where: { id: row.variant_id } });
        if (!variant) continue;

        const before = variant.stock_qty;
        const after = Math.max(0, before + row.stock_change);
        const reservedBefore = (variant as any).reserved_qty ?? 0;
        const reservedAfter = Math.max(0, reservedBefore + row.reserved_change);

        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock_qty: after, reserved_qty: reservedAfter } as any,
        });

        if (after !== before) {
          await tx.inventoryMovement.create({
            data: {
              variant_id: variant.id,
              type: 'ADJUSTMENT',
              quantity: Math.abs(after - before),
              before_qty: before,
              after_qty: after,
              reference: 'stock-reconciliation-v1',
              note:
                `Reconciliation: stock consumed by ${row.order_count} order(s) that never delivered ` +
                `was restored (${actor}).`,
            },
          });
        }
      }

      // Stamp every historic order with the state it now holds, so the normal
      // reconciler treats them correctly from here on.
      const orders = await tx.order.findMany({ select: { id: true, status: true, stock_state: true } as any });
      for (const o of orders as any[]) {
        if (o.stock_state) continue;
        await tx.order.update({
          where: { id: o.id },
          data: { stock_state: targetStockState(o.status) } as any,
        });
      }

      await tx.setting.upsert({
        where: { key: MIGRATION_KEY },
        update: {
          value: {
            done: true, at: new Date().toISOString(), by: actor,
            summary: {
              orders_affected: plan.orders_affected,
              variants_affected: plan.variants_affected,
              units_to_restore: plan.units_to_restore,
              units_to_remove: plan.units_to_remove,
            },
          } as any,
        },
        create: {
          key: MIGRATION_KEY,
          value: {
            done: true, at: new Date().toISOString(), by: actor,
            summary: {
              orders_affected: plan.orders_affected,
              variants_affected: plan.variants_affected,
              units_to_restore: plan.units_to_restore,
              units_to_remove: plan.units_to_remove,
            },
          } as any,
        },
      });
    });

    return { applied: true, ...plan, already_run: false };
  }
}
