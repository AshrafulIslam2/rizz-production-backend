/**
 * The return and refund workflow.
 *
 * Kept separate from the order status because they are separate facts: goods
 * can come back without money going out (an exchange, or a rejected claim),
 * and money can go out without goods coming back (a goodwill refund on a
 * damaged parcel the customer keeps). One field cannot say both, and trying to
 * make it is how a shop ends up refunding twice.
 *
 * Three chains run in parallel here:
 *
 *   return_status   none → requested → approved → received
 *                                   ↘ rejected
 *   refund_status   derived from how much has actually been refunded
 *   payment_status  follows the refund, because a refund is money moving back
 */

import {
  PaymentStatus,
  RefundStatus,
  ReturnStatus,
  paymentStatusOf,
  refundStatusOf,
  returnStatusOf,
} from './order-status';

/**
 * Which return states can follow which.
 *
 * `none` is reachable from anywhere: an admin who logged a return against the
 * wrong order needs to be able to take it back. Everything else moves forward
 * only, so a received return cannot silently become a mere request again.
 */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  none: ['requested'],
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: [],
  // A rejected claim can be reopened — customers escalate, and the shop
  // sometimes changes its mind.
  rejected: ['requested'],
};

export function canTransitionReturn(from: unknown, to: unknown): boolean {
  const a = returnStatusOf(from);
  const b = returnStatusOf(to);
  if (a === b) return true;      // re-saving the same state is harmless
  if (b === 'none') return true; // always allow an admin to undo a mistake
  return RETURN_TRANSITIONS[a].includes(b);
}

/** Human explanation for a refused transition, for the API error body. */
export function explainReturnTransition(from: unknown, to: unknown): string {
  const a = returnStatusOf(from);
  const b = returnStatusOf(to);
  const allowed = [...RETURN_TRANSITIONS[a], 'none'];
  return `A return cannot go from "${a}" to "${b}". From "${a}" the next step is: ${allowed.join(', ')}.`;
}

function n(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const x = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : 0;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * What the refund status must be, given how much has actually gone back.
 *
 * Derived rather than typed in, so the badge can never disagree with the
 * figure beside it. The one thing the admin sets directly is "pending" —
 * refund approved but not yet sent — which only holds while nothing has moved.
 */
export function deriveRefundStatus(
  refundAmount: unknown,
  orderTotal: unknown,
  requested?: unknown,
): RefundStatus {
  const amount = n(refundAmount);
  const total = n(orderTotal);

  if (amount <= 0) return requested === 'pending' ? 'pending' : 'none';
  // A penny of float drift must not stop a full refund reading as full.
  if (total > 0 && amount >= total - 0.01) return 'full';
  return 'partial';
}

/**
 * What the payment status becomes once money has been refunded.
 *
 * A refund is the payment story continuing, not a new one — so this reads the
 * refund and rewrites the payment badge, rather than leaving an order showing
 * "Paid" after the shop has given the money back.
 */
export function paymentAfterRefund(
  currentPayment: unknown,
  refundAmount: unknown,
  amountPaid: unknown,
): PaymentStatus {
  const refunded = n(refundAmount);
  if (refunded <= 0) return paymentStatusOf(currentPayment);

  const paid = n(amountPaid);
  // Refunding everything that was collected closes the loop.
  if (paid > 0 && refunded >= paid - 0.01) return 'refunded';
  return 'partially_refunded';
}

export type RefundValidation = {
  ok: boolean;
  amount: number;
  error?: string;
};

/**
 * Check a proposed refund against what was actually collected.
 *
 * Refusing to refund more than was taken is the guard that matters: for COD
 * the money is real cash from a courier, and an over-refund is a straight
 * loss that no report would flag.
 */
export function validateRefund(
  refundAmount: unknown,
  amountPaid: unknown,
  orderTotal: unknown,
): RefundValidation {
  const amount = n(refundAmount);
  const paid = n(amountPaid);
  const total = n(orderTotal);

  if (amount < 0) {
    return { ok: false, amount, error: 'A refund cannot be negative.' };
  }
  if (amount === 0) return { ok: true, amount: 0 };

  if (paid <= 0) {
    return {
      ok: false,
      amount,
      error:
        `Nothing has been collected on this order yet, so there is nothing to refund. ` +
        `Record the payment first, or cancel the order instead.`,
    };
  }
  if (amount > paid + 0.01) {
    return {
      ok: false,
      amount,
      error: `Cannot refund ৳${round2(amount)} — only ৳${round2(paid)} was ever collected.`,
    };
  }
  if (total > 0 && amount > total + 0.01) {
    return {
      ok: false,
      amount,
      error: `Cannot refund ৳${round2(amount)} against an order of ৳${round2(total)}.`,
    };
  }

  return { ok: true, amount: round2(amount) };
}

/**
 * Whether the order's own status should follow the return.
 *
 * Only a physically received return moves the order to `returned` — a request
 * the shop has not accepted yet must not remove the sale from revenue, because
 * nothing has actually come back.
 */
export function orderStatusForReturn(returnStatus: unknown): 'returned' | null {
  return returnStatusOf(returnStatus) === 'received' ? 'returned' : null;
}

/** Summary of one order's return position, for the UI. */
export function describeReturn(order: {
  return_status?: unknown;
  refund_status?: unknown;
  refund_amount?: unknown;
  amount_paid?: unknown;
  total?: unknown;
}): {
  returnStatus: ReturnStatus;
  refundStatus: RefundStatus;
  refunded: number;
  refundable: number;
  nextSteps: ReturnStatus[];
} {
  const returnStatus = returnStatusOf(order?.return_status);
  const refunded = n(order?.refund_amount);
  return {
    returnStatus,
    refundStatus: refundStatusOf(order?.refund_status),
    refunded: round2(refunded),
    // What could still be given back, never more than was collected.
    refundable: round2(Math.max(0, n(order?.amount_paid) - refunded)),
    nextSteps: RETURN_TRANSITIONS[returnStatus],
  };
}
