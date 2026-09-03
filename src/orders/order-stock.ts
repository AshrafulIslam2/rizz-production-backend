/**
 * What stock an order is holding, and how to move between those states.
 *
 * Pure and dependency-free so the rules can be tested exhaustively — this is
 * the part of the system where a mistake quietly corrupts the shelf count, and
 * the corruption is only noticed weeks later when a customer is promised a
 * pair that does not exist.
 *
 * THE PROBLEM THIS REPLACES:
 *
 *   Stock used to be decremented the instant an order row was created, before
 *   anyone had spoken to the customer. A fake order therefore ate real
 *   inventory permanently — nothing ever gave it back, and no ledger row was
 *   written, so the loss was invisible.
 *
 * THE MODEL:
 *
 *   none      the order holds nothing
 *   reserved  the goods are spoken for but still physically on the shelf
 *   deducted  the goods have left the building
 *
 * Every status maps to exactly one of those. Moving an order between statuses
 * is then a diff between two states rather than an instruction, which is what
 * makes it safe to toggle Confirmed → Processing → Confirmed all day without
 * reserving the same pair three times.
 */

import { OrderStatus, statusOf } from './order-status';

export type StockState = 'none' | 'reserved' | 'deducted';

export const STOCK_STATES: StockState[] = ['none', 'reserved', 'deducted'];

export function stockStateOf(raw: unknown): StockState {
  const key = String(raw ?? '').trim().toLowerCase();
  return (STOCK_STATES as string[]).includes(key) ? (key as StockState) : 'none';
}

/** How returned goods were dealt with. */
export type RestockChoice = 'sellable' | 'damaged';

/**
 * What an order in this status SHOULD be holding.
 *
 * Note that shipped is still `reserved`, not `deducted`: until the customer
 * accepts the parcel it can come straight back, and for COD a meaningful share
 * does. Deducting on dispatch would show stock the shop does not have and hide
 * stock it does.
 */
export function targetStockState(status: unknown, restock?: unknown): StockState {
  const s: OrderStatus = statusOf(status);
  switch (s) {
    case 'confirmed':
    case 'processing':
    case 'shipped':
      return 'reserved';

    case 'delivered':
      return 'deducted';

    case 'returned':
      // Goods physically back. Whether they can be sold again is a judgement
      // the admin makes — a scuffed pair going back on the shelf is worse than
      // an honest write-off, so "damaged" keeps the stock deducted.
      return restock === 'damaged' ? 'deducted' : 'none';

    // Placed but untrusted, or dead. Neither holds anything.
    case 'pending':
    case 'verification_required':
    case 'cancelled':
    case 'fake':
    case 'duplicate':
    case 'failed':
    case 'test':
    case 'refunded':
    default:
      return 'none';
  }
}

export type StockDelta = {
  /** Change to ProductVariant.stock_qty, per unit ordered. */
  stock: number;
  /** Change to ProductVariant.reserved_qty, per unit ordered. */
  reserved: number;
};

/**
 * The difference between holding `from` and holding `to`, per unit.
 *
 * Identity transitions return zeroes, which is what makes every caller
 * idempotent for free: re-applying the same status is a no-op rather than a
 * second deduction.
 */
export function stockDelta(from: StockState, to: StockState): StockDelta {
  if (from === to) return { stock: 0, reserved: 0 };

  const holdsReserved = (s: StockState) => (s === 'reserved' ? 1 : 0);
  const holdsDeducted = (s: StockState) => (s === 'deducted' ? 1 : 0);

  return {
    // Deducting removes stock; undoing a deduction puts it back.
    stock: holdsDeducted(from) - holdsDeducted(to),
    reserved: holdsReserved(to) - holdsReserved(from),
  };
}

/**
 * Which ledger entry describes this movement, if any.
 *
 * There is deliberately no DAMAGE case here. A return written off as damaged
 * leaves the order in `deducted` — the pair was sold and never came back to
 * the shelf — so stock_qty does not move and no second ledger row is owed.
 * The write-off is recorded on the order's own history instead. Adjusting for
 * damage found in the warehouse is the inventory module's job, not an order's.
 */
export function movementTypeFor(from: StockState, to: StockState):
  'SALE' | 'RETURN' | 'ADJUSTMENT' | null {
  const d = stockDelta(from, to);
  if (d.stock === 0) return null; // a reservation change moves no goods
  if (d.stock < 0) return 'SALE';
  return from === 'deducted' ? 'RETURN' : 'ADJUSTMENT';
}

export type OrderItemLike = {
  slug?: unknown;
  size?: unknown;
  color?: unknown;
  quantity?: unknown;
};

/** Quantity on one order line, floored at zero. */
export function itemQty(item: OrderItemLike): number {
  const q = Number(item?.quantity);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : 0;
}

/** The key a variant is found by: slug + size + colour. */
export function variantKey(slug: unknown, size: unknown, color: unknown): string {
  return `${String(slug ?? '')}|${String(size ?? '')}|${String(color ?? '')}`;
}

/**
 * Collapse an order's lines into one quantity per variant key.
 *
 * Two lines of the same variant (easy to produce with a size picker) must
 * reserve two units, not overwrite each other.
 */
export function quantitiesByVariant(items: OrderItemLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items ?? []) {
    const qty = itemQty(item);
    if (!qty || !item?.slug) continue;
    const key = variantKey(item.slug, item.size, item.color);
    out.set(key, (out.get(key) ?? 0) + qty);
  }
  return out;
}

/**
 * What the historic data did, so the one-time reconciliation knows what to
 * undo: every order ever created decremented stock at creation, whatever
 * happened to it afterwards.
 */
export const LEGACY_STATE_AT_CREATION: StockState = 'deducted';
