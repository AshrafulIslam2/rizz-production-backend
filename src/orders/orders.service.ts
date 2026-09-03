import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CheckoutLeadsService } from '../checkout-leads/checkout-leads.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  ORDER_STATUSES,
  OrderStatus,
  REASON_REQUIRED_STATUSES,
  fulfillmentForStatus,
  fulfillmentStatusOf,
  isRevenue,
  normalizeStatus,
  ordersOnDay,
  paymentStatusOf,
  refundStatusOf,
  returnStatusOf,
  statusOf,
  summariseOrders,
} from './order-status';
import {
  StockState,
  movementTypeFor,
  quantitiesByVariant,
  stockDelta,
  stockStateOf,
  targetStockState,
  variantKey,
} from './order-stock';
import {
  canTransitionReturn,
  deriveRefundStatus,
  explainReturnTransition,
  orderStatusForReturn,
  paymentAfterRefund,
  validateRefund,
} from './order-returns';

/** What each stock state means, for the order's own history. */
const STOCK_NOTE: Record<string, string> = {
  none: 'Stock released — nothing held for this order',
  reserved: 'Stock reserved — still on the shelf, spoken for',
  deducted: 'Stock deducted — the goods have left',
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
    private readonly checkoutLeadsService: CheckoutLeadsService,
  ) {}

  /**
   * Next free ORZ-nnn.
   *
   * This used to be `count() + 1`, which breaks the moment any order is
   * deleted: the count drops, the next order reuses a number that already
   * exists, and `order_number @unique` rejects the write — a failed checkout
   * for a real customer. Dummy orders HAVE been deleted from this database,
   * so that was live. Taking the numeric maximum survives deletion; the retry
   * in `create` covers two checkouts landing in the same millisecond.
   */
  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.order.findMany({ select: { order_number: true } });
    let max = 0;
    for (const r of rows) {
      const digits = String(r.order_number ?? '').replace(/\D/g, '');
      const n = Number(digits);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `ORZ-${String(max + 1).padStart(3, '0')}`;
  }

  /**
   * Orders, newest first.
   *
   * Filtering is done in memory against the normalised status so asking for
   * "shipped" also returns rows still stored as "dispatched". The volume here
   * is a few thousand rows at most; correctness is worth more than the index.
   */
  async findAll(status?: string, includeArchived = false) {
    const rows = await this.prisma.order.findMany({
      where: includeArchived ? {} : ({ is_archived: false } as any),
      orderBy: { created_at: 'desc' },
    });
    const wanted = status ? normalizeStatus(status) : null;
    if (!status || status === 'all' || !wanted) return rows;
    return rows.filter((o) => statusOf(o.status) === wanted);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id } as any,
      include: { history: { orderBy: { created_at: 'asc' } } },
    } as any);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto) {
    // Retried because two checkouts can pick the same number concurrently.
    // P2002 is Prisma's unique-constraint code; anything else rethrows at once
    // so a real failure is never mistaken for a race.
    let order: any;
    for (let attempt = 0; ; attempt++) {
      try {
        order = await this.createOnce(dto);
        break;
      } catch (e: any) {
        const isNumberClash =
          e?.code === 'P2002' && String(e?.meta?.target ?? '').includes('order_number');
        if (!isNumberClash || attempt >= 4) throw e;
      }
    }

    if (dto.campaign_ids && dto.campaign_ids.length > 0) {
      await this.campaignsService.registerUsage(dto.campaign_ids);
    }

    await this.checkoutLeadsService.markConvertedByPhone(dto.customer_phone);

    return order;
  }

  private async createOnce(dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order_number = await this.nextOrderNumber(tx);
      const created = await tx.order.create({
        data: {
          order_number,
          customer_name: dto.customer_name,
          customer_phone: dto.customer_phone,
          customer_email: dto.customer_email,
          division: dto.division,
          district: dto.district,
          area: dto.area,
          address: dto.address,
          items: dto.items,
          subtotal: dto.subtotal,
          shipping_fee: dto.shipping_fee ?? 0,
          discount_amount: dto.discount_amount ?? 0,
          promo_code: dto.promo_code,
          campaign_ids: dto.campaign_ids ?? [],
          free_gifts: dto.free_gifts ?? undefined,
          total: dto.total,
          payment_method: dto.payment_method ?? 'COD',
          notes: dto.notes,
        },
      });

      // Deliberately no stock movement here. A newly placed COD order is a
      // claim, not a sale — stock is reserved when it is confirmed and only
      // leaves the books when it is delivered.
      return created;
    });
  }

  /**
   * Find the variant an order line refers to.
   *
   * Matching is by size + colour within the product; a single-variant product
   * matches unconditionally, which is how simple products behave today.
   */
  private async resolveVariant(tx: Prisma.TransactionClient, item: any) {
    if (!item?.slug) return null;
    const product = await tx.product.findUnique({
      where: { slug: String(item.slug) },
      include: { variants: true },
    });
    if (!product || product.variants.length === 0) return null;

    return (
      product.variants.find(
        (v) =>
          String((v.attributes as any)?.size ?? '') === String(item.size ?? '') &&
          String((v.attributes as any)?.color ?? '') === String(item.color ?? ''),
      ) ?? (product.variants.length === 1 ? product.variants[0] : null)
    );
  }

  /**
   * Bring an order's stock holding into line with its status.
   *
   * This is the heart of phase 3. Stock is no longer touched when an order row
   * is created — an unverified order is just a claim, and deducting for it is
   * what let fake orders eat real inventory invisibly. Instead:
   *
   *   Confirmed / Processing / Shipped  reserve   (still on the shelf)
   *   Delivered                          deduct    (gone, ledgered as a SALE)
   *   Cancelled / Fake / Duplicate       release   (nothing lost)
   *
   * The move is computed as a diff between the order's stored stock_state and
   * the state its status implies, so calling this twice does nothing the
   * second time.
   */
  private async syncOrderStock(
    tx: Prisma.TransactionClient,
    order: any,
    nextStatus: string,
    actor = 'admin',
  ): Promise<StockState> {
    const from = stockStateOf(order?.stock_state);
    const to = targetStockState(nextStatus, order?.return_restock);
    if (from === to) return from;

    const delta = stockDelta(from, to);
    const movement = movementTypeFor(from, to);
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    const quantities = quantitiesByVariant(items);

    for (const item of items) {
      const key = variantKey(item?.slug, item?.size, item?.color);
      const qty = quantities.get(key);
      // Each variant is handled once even when it appears on several lines.
      if (!qty) continue;
      quantities.delete(key);

      const variant = await this.resolveVariant(tx, item);
      if (!variant) continue;

      const before = variant.stock_qty;
      // Stock is floored at zero: historic data can be inconsistent, and a
      // negative shelf count would be a worse lie than a slightly high one.
      const after = Math.max(0, before + delta.stock * qty);
      const reservedBefore = (variant as any).reserved_qty ?? 0;
      const reservedAfter = Math.max(0, reservedBefore + delta.reserved * qty);

      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock_qty: after, reserved_qty: reservedAfter } as any,
      });

      // Only a real change of goods earns a ledger row — a reservation moves
      // nothing physical, so writing one would make the ledger lie.
      if (movement && after !== before) {
        await tx.inventoryMovement.create({
          data: {
            variant_id: variant.id,
            type: movement as any,
            quantity: Math.abs(after - before),
            before_qty: before,
            after_qty: after,
            reference: order.order_number ?? order.id,
            note: `Order ${order.order_number ?? order.id}: ${from} → ${to} (${actor})`,
          },
        });
      }
    }

    return to;
  }

  async getProfitStats() {
    // Same rule as everywhere else: only a delivered order is a sale. Read
    // through isRevenue so a legacy spelling cannot slip past a string match.
    const all = await this.prisma.order.findMany();
    const orders = all.filter((o) => isRevenue(o.status));

    // Build variant lookup: slug+size+color → production_price
    const products = await this.prisma.product.findMany({
      select: {
        slug: true,
        variants: { select: { attributes: true, production_price: true, price: true } },
      },
    });

    const variantMap = new Map<string, number>();
    for (const product of products as any[]) {
      for (const v of product.variants ?? []) {
        const size = String((v.attributes as any)?.size ?? '');
        const color = String((v.attributes as any)?.color ?? '');
        const key = `${product.slug}|${size}|${color}`;
        if (v.production_price != null) {
          variantMap.set(key, v.production_price);
        }
      }
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let itemsWithCost = 0;

    for (const order of orders) {
      totalRevenue += order.total ?? 0;
      const items: any[] = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const qty = Number(item?.quantity) || 1;
        const key = `${item?.slug}|${String(item?.size ?? '')}|${String(item?.color ?? '')}`;
        const prodCost = variantMap.get(key);
        if (prodCost != null) {
          totalCost += prodCost * qty;
          itemsWithCost += qty;
        }
      }
    }

    const totalProfit = totalRevenue - totalCost;
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      deliveredOrders: orders.length,
      itemsWithCost,
    };
  }

  // ── Audit trail ───────────────────────────────────────────────────────────

  /**
   * Record one change. Called inside the same transaction as the change
   * itself, so an order can never move without the trail moving with it.
   */
  private async log(
    tx: Prisma.TransactionClient,
    order_id: string,
    field: string,
    from_value: string | null,
    to_value: string,
    changed_by: string,
    note?: string | null,
  ) {
    await tx.orderStatusHistory.create({
      data: { order_id, field, from_value, to_value, changed_by, note: note ?? null },
    } as any);
  }

  /** Full audit trail for one order, oldest first. */
  async getHistory(id: string) {
    await this.findOne(id);
    return this.prisma.orderStatusHistory.findMany({
      where: { order_id: id },
      orderBy: { created_at: 'asc' },
    } as any);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Move an order to a new commercial status.
   *
   * Three things happen that did not before:
   *   - the status is validated, not trusted (any string used to be written
   *     straight to the column, so one typo dropped the order out of every
   *     total silently);
   *   - cancelling, faking or duplicating requires a reason;
   *   - the change is written to the audit trail in the same transaction.
   *
   * Fulfilment follows along where it obviously should. Payment never does —
   * for COD the cash arrives separately, and assuming otherwise is exactly the
   * error this whole rework exists to remove.
   */
  async updateStatus(id: string, status: string, opts: any = {}) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const next = normalizeStatus(status);
    if (!next) {
      throw new BadRequestException(
        `Unknown status "${status}". Expected one of: ${ORDER_STATUSES.join(', ')}`,
      );
    }

    const reason = String(opts?.reason ?? opts?.notes ?? '').trim();
    if (REASON_REQUIRED_STATUSES.includes(next) && !reason) {
      throw new BadRequestException(
        `A reason is required to mark an order ${next}. It is kept for fraud analysis.`,
      );
    }

    const actor = String(opts?.changed_by ?? 'admin');
    const previous = statusOf((order as any).status);
    const data: any = { status: next };

    // Keep the physical state in step, without ever overriding a courier
    // state the admin set deliberately.
    const fulfilment = fulfillmentForStatus(next);
    if (fulfilment) data.fulfillment_status = fulfilment;
    if (next === 'shipped' && !(order as any).shipped_at) data.shipped_at = new Date();
    if (next === 'delivered' && !(order as any).delivered_at) data.delivered_at = new Date();

    if (REASON_REQUIRED_STATUSES.includes(next)) {
      data.void_reason = reason;
      data.voided_by = actor;
      data.voided_at = new Date();
    }
    if (opts?.internal_note !== undefined) data.internal_note = opts.internal_note;

    return this.prisma.$transaction(async (tx) => {
      // Stock moves inside the same transaction as the status: the two can
      // never disagree, even if the process dies mid-write.
      const beforeState = stockStateOf((order as any).stock_state);
      const afterState = await this.syncOrderStock(tx, order, next, actor);
      data.stock_state = afterState;

      const updated = await tx.order.update({ where: { id } as any, data });
      await this.log(tx, id, 'status', previous, next, actor, reason || null);
      if (afterState !== beforeState) {
        await this.log(tx, id, 'stock', beforeState, afterState, actor,
          STOCK_NOTE[afterState] ?? null);
      }
      if (fulfilment && fulfilment !== fulfillmentStatusOf((order as any).fulfillment_status)) {
        await this.log(
          tx, id, 'fulfillment_status',
          fulfillmentStatusOf((order as any).fulfillment_status), fulfilment, actor,
          'Followed the order status',
        );
      }
      return updated;
    });
  }

  /**
   * COD verification — the gate between "someone typed a phone number" and
   * "this is a real order we will spend leather on".
   */
  async verifyOrder(id: string, dto: any) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const actor = String(dto?.verified_by ?? 'admin');
    const method = dto?.verification_method ? String(dto.verification_method) : null;
    const note = dto?.note ? String(dto.note) : null;
    const confirm = dto?.confirm !== false;
    const previous = statusOf((order as any).status);

    return this.prisma.$transaction(async (tx) => {
      const data: any = {
        verified: true,
        customer_contacted: dto?.customer_contacted !== false,
        verification_method: method,
        verified_by: actor,
        verified_at: new Date(),
        verification_note: note,
      };
      // Verifying normally confirms the order, but only from a state where
      // that makes sense — verifying an already-shipped order must not drag
      // it backwards.
      if (confirm && (previous === 'pending' || previous === 'verification_required')) {
        data.status = 'confirmed';
      }

      // Confirming through verification reserves the stock, exactly as
      // confirming through the status action does.
      if (data.status) {
        const beforeState = stockStateOf((order as any).stock_state);
        const afterState = await this.syncOrderStock(tx, order, data.status, actor);
        data.stock_state = afterState;
        if (afterState !== beforeState) {
          await this.log(tx, id, 'stock', beforeState, afterState, actor, STOCK_NOTE[afterState] ?? null);
        }
      }

      const updated = await tx.order.update({ where: { id } as any, data });
      await this.log(tx, id, 'verification', previous, 'verified', actor,
        [method, note].filter(Boolean).join(' — ') || null);
      if (data.status) await this.log(tx, id, 'status', previous, 'confirmed', actor, 'Verified');
      return updated;
    });
  }

  /** Mark fake / duplicate. Never deletes — the record IS the fraud evidence. */
  async markFake(id: string, dto: any) {
    const reason = String(dto?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('A reason is required when marking an order fake.');
    return this.updateStatus(id, dto?.duplicate ? 'duplicate' : 'fake', {
      reason,
      changed_by: dto?.marked_by ?? 'admin',
      internal_note: dto?.internal_note,
    });
  }

  async cancelOrder(id: string, dto: any) {
    const reason = String(dto?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('A reason is required when cancelling an order.');
    return this.updateStatus(id, 'cancelled', {
      reason,
      changed_by: dto?.cancelled_by ?? 'admin',
      internal_note: dto?.internal_note,
    });
  }

  /**
   * Record cash actually received.
   *
   * Separate from delivery on purpose: this is the action that turns a
   * delivered parcel into collected revenue, so the shop can see what the
   * courier still owes it.
   */
  async recordPayment(id: string, dto: any) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const total = Number((order as any).total) || 0;
    const already = Number((order as any).amount_paid) || 0;
    // No amount given means "the customer paid the rest", which is the normal
    // COD case and saves retyping the figure.
    const incoming = dto?.amount === undefined || dto?.amount === null || dto?.amount === ''
      ? Math.max(0, total - already)
      : Number(dto.amount);

    if (!Number.isFinite(incoming) || incoming < 0) {
      throw new BadRequestException('Payment amount must be a positive number.');
    }

    const amount_paid = Math.round((already + incoming) * 100) / 100;
    if (amount_paid > total + 0.01) {
      throw new BadRequestException(
        `That would collect ৳${amount_paid} against an order of ৳${total}.`,
      );
    }

    const payment_status = amount_paid <= 0 ? 'unpaid' : amount_paid >= total - 0.01 ? 'paid' : 'partially_paid';
    const actor = String(dto?.recorded_by ?? 'admin');
    const before = paymentStatusOf((order as any).payment_status);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id } as any,
        data: {
          amount_paid,
          payment_status,
          paid_at: payment_status === 'paid' ? new Date() : (order as any).paid_at,
          payment_note: dto?.note ?? (order as any).payment_note,
        } as any,
      });
      await this.log(tx, id, 'payment_status', before, payment_status, actor,
        `Collected ৳${incoming}${dto?.note ? ` — ${dto.note}` : ''}`);
      return updated;
    });
  }

  /** Courier and tracking, plus the shipped timestamp. */
  async updateFulfillment(id: string, dto: any) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const actor = String(dto?.changed_by ?? 'admin');
    const before = fulfillmentStatusOf((order as any).fulfillment_status);
    const data: any = {};
    if (dto?.courier !== undefined) data.courier = dto.courier || null;
    if (dto?.tracking_id !== undefined) data.tracking_id = dto.tracking_id || null;
    if (dto?.fulfillment_status !== undefined) {
      data.fulfillment_status = fulfillmentStatusOf(dto.fulfillment_status);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id } as any, data });
      if (data.fulfillment_status && data.fulfillment_status !== before) {
        await this.log(tx, id, 'fulfillment_status', before, data.fulfillment_status, actor,
          [dto?.courier, dto?.tracking_id].filter(Boolean).join(' · ') || null);
      } else if (dto?.courier !== undefined || dto?.tracking_id !== undefined) {
        await this.log(tx, id, 'fulfillment_status', before, before, actor,
          `Courier: ${dto?.courier || '—'} · Tracking: ${dto?.tracking_id || '—'}`);
      }
      return updated;
    });
  }

  /**
   * Returns and refunds, kept as two separate facts.
   *
   * The return chain is guarded — a claim cannot jump from "none" straight to
   * "received", because that would mean goods appeared without anyone
   * accepting them back. The refund is validated against what was actually
   * collected, which for COD is real cash from a courier: refunding more than
   * was taken is a straight loss no report would flag.
   */
  async updateReturn(id: string, dto: any) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const actor = String(dto?.changed_by ?? 'admin');
    const fromReturn = returnStatusOf((order as any).return_status);
    const data: any = {};

    // ── The return chain ──
    if (dto?.return_status !== undefined) {
      const toReturn = returnStatusOf(dto.return_status);
      if (!canTransitionReturn(fromReturn, toReturn)) {
        throw new BadRequestException(explainReturnTransition(fromReturn, toReturn));
      }
      data.return_status = toReturn;
    }
    const nextReturn = data.return_status ?? fromReturn;

    // ── The refund, validated against cash actually collected ──
    const total = Number((order as any).total) || 0;
    const paid = Number((order as any).amount_paid) || 0;
    let refundAmount = Number((order as any).refund_amount) || 0;

    if (dto?.refund_amount !== undefined) {
      const check = validateRefund(dto.refund_amount, paid, total);
      if (!check.ok) throw new BadRequestException(check.error);
      refundAmount = check.amount;
      data.refund_amount = refundAmount;
    }

    // Derived, never typed, so the badge cannot disagree with the figure.
    data.refund_status = deriveRefundStatus(refundAmount, total, dto?.refund_status);
    if (refundAmount > 0) {
      data.payment_status = paymentAfterRefund((order as any).payment_status, refundAmount, paid);
    }

    // Only goods physically received move the order out of the sale.
    const followOn = orderStatusForReturn(nextReturn);

    // Restocking is a deliberate choice — blindly returning goods to sellable
    // stock is how a damaged pair reaches the next customer.
    if (dto?.return_restock !== undefined) data.return_restock = dto.return_restock || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto?.return_status !== undefined && data.return_status !== fromReturn) {
        await this.log(tx, id, 'return', fromReturn, data.return_status, actor, dto?.note ?? null);
      }
      if (dto?.refund_amount !== undefined) {
        await this.log(
          tx, id, 'refund',
          String(Number((order as any).refund_amount) || 0), String(refundAmount), actor,
          `Refund ৳${refundAmount} of ৳${paid} collected — ${data.refund_status}`,
        );
      }

      // Goods only come back to the shelf once the return is received AND the
      // admin has said they are sellable.
      if (followOn) {
        const restock = data.return_restock ?? (order as any).return_restock ?? 'sellable';
        const beforeState = stockStateOf((order as any).stock_state);
        const afterState = await this.syncOrderStock(
          tx, { ...(order as any), return_restock: restock }, 'returned', actor,
        );
        data.stock_state = afterState;
        data.status = 'returned';
        data.fulfillment_status = 'returned';
        if (afterState !== beforeState) {
          await this.log(tx, id, 'stock', beforeState, afterState, actor,
            restock === 'damaged'
              ? 'Returned goods written off — not put back on sale'
              : 'Returned goods put back on the shelf');
        }
        if (statusOf((order as any).status) !== 'returned') {
          await this.log(tx, id, 'status', statusOf((order as any).status), 'returned', actor, 'Return received');
        }
      }

      return tx.order.update({ where: { id } as any, data });
    });

    return updated;
  }

  /** Internal note — visible to staff, never to the customer. */
  async setInternalNote(id: string, dto: any) {
    await this.findOne(id);
    const actor = String(dto?.changed_by ?? 'admin');
    const note = String(dto?.internal_note ?? '');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id } as any,
        data: { internal_note: note } as any,
      });
      await this.log(tx, id, 'note', null, 'updated', actor, note.slice(0, 500) || null);
      return updated;
    });
  }

  /** Hide from the working list without destroying anything. */
  async setArchived(id: string, archived: boolean, actor = 'admin') {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id } as any,
        data: { is_archived: archived } as any,
      });
      await this.log(tx, id, 'archive', String(!archived), String(archived), actor, null);
      return updated;
    });
  }

  /**
   * Permanent deletion, deliberately almost impossible.
   *
   * Only a row explicitly marked as a Test Order can go, and only with the
   * confirmation phrase. Real orders — including fake ones — are never
   * destroyed: a repeat fraudster is only detectable because the old rows are
   * still there.
   *
   * NOTE: this is not a substitute for a role check. The admin API has no user
   * sessions yet, so "Super Admin only" cannot be enforced server-side; the
   * test-order restriction is what stands in for it today.
   */
  async hardDelete(id: string, confirm?: string) {
    const order = await this.findOne(id);
    if (statusOf((order as any).status) !== 'test') {
      throw new BadRequestException(
        'Only a Test Order can be deleted permanently. Use Cancel, Mark Fake or Archive instead — order history is kept for fraud analysis.',
      );
    }
    if (confirm !== 'PERMANENT') {
      throw new BadRequestException('Pass confirm=PERMANENT to delete a test order permanently.');
    }
    return this.prisma.order.delete({ where: { id } as any });
  }

  /**
   * Numbers that keep producing orders the shop never gets paid for.
   *
   * Ranked by a simple, explainable score rather than anything clever: a fake
   * order is the strongest signal, a cancellation a weaker one, and a
   * delivered order pulls the score back down because a real customer who once
   * had an order marked fake is still a real customer.
   *
   * Nothing here blocks anybody. It is a list to look at before confirming a
   * large COD order, and that is all it should be.
   */
  async getFraudCustomers(minScore = 1) {
    const orders = await this.prisma.order.findMany({
      select: {
        customer_name: true, customer_phone: true, customer_email: true,
        status: true, total: true, created_at: true, void_reason: true,
      },
      orderBy: { created_at: 'desc' },
    });

    type Entry = {
      phone: string; name: string; email: string;
      total: number; delivered: number; cancelled: number; fake: number; returned: number;
      fakeValue: number; deliveredValue: number;
      lastOrder: Date; reasons: string[];
    };
    const byPhone = new Map<string, Entry>();

    for (const o of orders) {
      const phone = String(o.customer_phone ?? '').trim();
      if (!phone) continue;

      const e = byPhone.get(phone) ?? {
        phone, name: o.customer_name ?? '', email: o.customer_email ?? '',
        total: 0, delivered: 0, cancelled: 0, fake: 0, returned: 0,
        fakeValue: 0, deliveredValue: 0, lastOrder: o.created_at, reasons: [],
      };

      e.total += 1;
      const st = statusOf(o.status);
      if (st === 'delivered') { e.delivered += 1; e.deliveredValue += o.total ?? 0; }
      if (st === 'cancelled') e.cancelled += 1;
      if (st === 'returned') e.returned += 1;
      if (st === 'fake' || st === 'duplicate') {
        e.fake += 1;
        e.fakeValue += o.total ?? 0;
        const reason = String(o.void_reason ?? '').trim();
        if (reason && !e.reasons.includes(reason)) e.reasons.push(reason);
      }
      if (o.created_at > e.lastOrder) e.lastOrder = o.created_at;

      byPhone.set(phone, e);
    }

    const rows = Array.from(byPhone.values())
      .map((e) => ({
        ...e,
        // Weighted so one fake outranks several cancellations, and a genuine
        // delivered order counts in the customer's favour.
        score: e.fake * 3 + e.cancelled * 1 + e.returned * 0.5 - e.delivered * 1.5,
        fakeRate: e.total > 0 ? Math.round((e.fake / e.total) * 100) : 0,
      }))
      .filter((e) => e.fake > 0 && e.score >= minScore)
      .sort((a, b) => b.score - a.score || b.fake - a.fake);

    return {
      customers: rows,
      totals: {
        flaggedNumbers: rows.length,
        fakeOrders: rows.reduce((t, r) => t + r.fake, 0),
        valueKeptOutOfRevenue: Math.round(rows.reduce((t, r) => t + r.fakeValue, 0) * 100) / 100,
      },
    };
  }

  /**
   * Everything this phone number has done before.
   *
   * Shown as a warning on a new order, never as an automatic rejection — the
   * admin decides. A customer who was once marked fake may well be genuine
   * the second time.
   */
  async getCustomerHistory(phone: string, excludeOrderId?: string) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (digits.length < 6) return null;

    const rows = await this.prisma.order.findMany({
      where: { customer_phone: { contains: digits.slice(-9) } } as any,
      select: { id: true, order_number: true, status: true, total: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    const others = rows.filter((o) => o.id !== excludeOrderId);
    const s = summariseOrders(others);

    return {
      phone,
      totalOrders: others.length,
      delivered: s.orders.delivered,
      cancelled: s.orders.cancelled,
      fake: s.orders.fake + s.orders.duplicate,
      returned: s.orders.returned,
      deliveredValue: s.financial.deliveredSales,
      /** The one thing the admin actually needs to see at a glance. */
      hasFakeHistory: s.orders.fake + s.orders.duplicate > 0,
      recent: others.slice(0, 10),
    };
  }

  /**
   * Every headline figure for the dashboard, in one call.
   *
   * The point of this endpoint is that the numbers come from one shared set of
   * status rules (see order-status.ts) instead of each screen inventing its
   * own filter — which is exactly how "Revenue" came to mean "the sum of
   * whatever orders happened to be on screen".
   */
  async getOrderSummary(from?: Date, to?: Date) {
    const where: any = { is_archived: false };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        total: true, status: true, created_at: true,
        amount_paid: true, refund_amount: true, payment_status: true,
      },
    } as any);

    return {
      ...summariseOrders(orders),
      today: summariseOrders(ordersOnDay(orders, new Date())),
      generated_at: new Date().toISOString(),
    };
  }
}
