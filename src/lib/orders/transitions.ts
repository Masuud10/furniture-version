/**
 * The order state machine, mirrored for the UI.
 *
 * The authority is `public.order_status_transitions` in the database, read by
 * `advance_order_status`. This file exists so the admin console can offer
 * exactly the legal next steps instead of a free-form status dropdown — never
 * so the rules can be decided here. If the two disagree, the database wins and
 * this file is wrong.
 *
 * The enums below are checked against the generated database types at the
 * bottom of this file. That check is what stops this mirror from drifting.
 */

import type { Enums } from '@/lib/database.types';

export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CANCELLATION_REASONS = [
  'customer_changed_mind',
  'customer_unreachable',
  'customer_no_show',
  'out_of_stock',
  'delivery_not_possible',
  'damaged_in_transit',
  'merchant_error',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export interface Transition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  /** Cancellations and returns are counted, so they carry a code. */
  readonly requiresReason: boolean;
  /** What the button says. One job per label, active voice. */
  readonly label: string;
}

/**
 * Must stay identical to the rows inserted in
 * `supabase/migrations/20260820090300_commerce.sql`.
 */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'pending_confirmation', to: 'confirmed', requiresReason: false, label: 'Confirm order' },
  { from: 'pending_confirmation', to: 'cancelled', requiresReason: true, label: 'Cancel order' },
  { from: 'confirmed', to: 'in_production', requiresReason: false, label: 'Start production' },
  { from: 'confirmed', to: 'cancelled', requiresReason: true, label: 'Cancel order' },
  { from: 'in_production', to: 'ready_for_delivery', requiresReason: false, label: 'Mark ready' },
  { from: 'in_production', to: 'cancelled', requiresReason: true, label: 'Cancel order' },
  {
    from: 'ready_for_delivery',
    to: 'out_for_delivery',
    requiresReason: false,
    label: 'Send out for delivery',
  },
  { from: 'ready_for_delivery', to: 'cancelled', requiresReason: true, label: 'Cancel order' },
  { from: 'out_for_delivery', to: 'delivered', requiresReason: false, label: 'Mark delivered' },
  // A failed delivery attempt is routine and must not need a cancellation to
  // be modelled.
  {
    from: 'out_for_delivery',
    to: 'ready_for_delivery',
    requiresReason: false,
    label: 'Delivery attempt failed',
  },
  { from: 'out_for_delivery', to: 'cancelled', requiresReason: true, label: 'Cancel order' },
  { from: 'delivered', to: 'returned', requiresReason: true, label: 'Record return' },
] as const;

export const TERMINAL_STATUSES = ['cancelled', 'returned'] as const satisfies readonly OrderStatus[];

export function isTerminal(status: OrderStatus): boolean {
  return (TERMINAL_STATUSES as readonly OrderStatus[]).includes(status);
}

/** Everything an admin may legally do to an order in this state. */
export function nextTransitions(from: OrderStatus): readonly Transition[] {
  return TRANSITIONS.filter((t) => t.from === from);
}

export function findTransition(from: OrderStatus, to: OrderStatus): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return findTransition(from, to) !== undefined;
}

export function requiresReason(from: OrderStatus, to: OrderStatus): boolean {
  return findTransition(from, to)?.requiresReason ?? false;
}

/**
 * Cash is collected on delivery, so this is the only state where recording a
 * payment makes sense. An unpaid delivered order is a real and important state:
 * the driver handed the piece over and did not come back with the money.
 */
export function canMarkPaid(status: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return status === 'delivered' && paymentStatus === 'unpaid';
}

/** Reasons that count against the customer rather than against the workshop. */
export const CUSTOMER_FAULT_REASONS = ['customer_no_show'] as const satisfies readonly CancellationReason[];

export function incrementsNoShowCount(reason: CancellationReason): boolean {
  return (CUSTOMER_FAULT_REASONS as readonly CancellationReason[]).includes(reason);
}

const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pending_confirmation: 'Waiting for confirmation',
  confirmed: 'Confirmed',
  in_production: 'Being made',
  ready_for_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** What the customer reads on their order. Plain, not jargon. */
export function statusLabel(status: OrderStatus): string {
  return STATUS_LABELS[status];
}

const REASON_LABELS: Readonly<Record<CancellationReason, string>> = {
  customer_changed_mind: 'Customer changed their mind',
  customer_unreachable: 'Could not reach the customer',
  customer_no_show: 'Nobody there on delivery',
  out_of_stock: 'We could not make it',
  delivery_not_possible: 'Could not deliver to the address',
  damaged_in_transit: 'Damaged in transit',
  merchant_error: 'Our mistake',
};

export function reasonLabel(reason: CancellationReason): string {
  return REASON_LABELS[reason];
}

/**
 * The order of the happy path, for rendering a progress rail. Terminal states
 * are deliberately absent: an order that was cancelled did not travel further
 * along this line, it left it.
 */
export const HAPPY_PATH = [
  'pending_confirmation',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
] as const satisfies readonly OrderStatus[];

// ---------------------------------------------------------------------------
// Drift guard
// ---------------------------------------------------------------------------

/** `true` only when the two unions are the same set, in both directions. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/**
 * If a migration adds, removes or renames an enum value and this file is not
 * updated, one of these becomes `never` and the assignment stops compiling.
 * Exported so it counts as used — this is a real check, not a lint casualty.
 *
 * The transition rows themselves cannot be checked at compile time; they live
 * in `order_status_transitions` and are covered by the pgTAP-style suite in
 * supabase/tests plus the row-count assertion in transitions.test.ts.
 */
export const DATABASE_ENUMS_MATCH: [
  Exact<OrderStatus, Enums<'order_status'>>,
  Exact<PaymentStatus, Enums<'payment_status'>>,
  Exact<CancellationReason, Enums<'cancellation_reason'>>,
] = [true, true, true];
