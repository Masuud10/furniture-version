# Domain — orders, states, and the rules around them

The order lifecycle is the product. Everything else is a catalogue.

---

## 1. Order status

    PENDING_CONFIRMATION   placed by the customer, not yet acknowledged by a human
    CONFIRMED              merchant has spoken to the customer; the order is real
    IN_PRODUCTION          being made or being picked from stock
    READY_FOR_DELIVERY     finished, waiting for a delivery slot
    OUT_FOR_DELIVERY       with the driver, today
    DELIVERED              handed over and accepted
    CANCELLED              terminal; requires a reason code
    RETURNED               terminal; delivered then came back

## 2. Payment status

    UNPAID                 the default for every cash-on-delivery order
    PAID                   cash collected

`PAID` is settable **only when status is `DELIVERED`**. This is enforced in
`advance_order_status` and by a check on the payment mutation, not by the UI. An
unpaid `DELIVERED` order is a real and important state: the driver handed the
piece over and did not come back with the money. It must be visible, not
impossible.

## 3. Legal transitions

This table is the authority. It is implemented as data in
`order_status_transitions(from_status, to_status, requires_reason)`, read by
`advance_order_status`, and mirrored in `src/lib/orders/transitions.ts` from the
generated types. **No status is ever set by a bare `UPDATE`.**

| From | To | Notes |
|---|---|---|
| `PENDING_CONFIRMATION` | `CONFIRMED` | the confirmation call happened |
| `PENDING_CONFIRMATION` | `CANCELLED` | reason required |
| `CONFIRMED` | `IN_PRODUCTION` | blocked above the value ceiling without a confirmation event |
| `CONFIRMED` | `CANCELLED` | reason required |
| `IN_PRODUCTION` | `READY_FOR_DELIVERY` | |
| `IN_PRODUCTION` | `CANCELLED` | reason required; work already spent |
| `READY_FOR_DELIVERY` | `OUT_FOR_DELIVERY` | |
| `READY_FOR_DELIVERY` | `CANCELLED` | reason required |
| `OUT_FOR_DELIVERY` | `DELIVERED` | |
| `OUT_FOR_DELIVERY` | `READY_FOR_DELIVERY` | delivery attempt failed; back to the queue |
| `OUT_FOR_DELIVERY` | `CANCELLED` | reason required; typically `customer_no_show` |
| `DELIVERED` | `RETURNED` | reason required |

Everything not in this table is illegal, including
`PENDING_CONFIRMATION → DELIVERED`, any transition out of `CANCELLED` or
`RETURNED`, and any transition to itself.

`OUT_FOR_DELIVERY → READY_FOR_DELIVERY` is deliberate. A failed delivery attempt
is routine and must not force a cancellation to model it.

### Diagram

    PENDING_CONFIRMATION ─► CONFIRMED ─► IN_PRODUCTION ─► READY_FOR_DELIVERY
             │                  │              │            │        ▲
             │                  │              │            ▼        │
             │                  │              │      OUT_FOR_DELIVERY
             │                  │              │            │
             │                  │              │            ▼
             │                  │              │        DELIVERED ─► RETURNED
             ▼                  ▼              ▼            │
            CANCELLED ◄─────────┴──────────────┴────────────┘
                              (reason code required)

## 4. Cancellation reason codes

Required on every transition to `CANCELLED` or `RETURNED`. Stored as an enum, not
free text, because they are counted.

| Code | Meaning | Increments `no_show_count` |
|---|---|---|
| `customer_changed_mind` | customer cancelled | no |
| `customer_unreachable` | no answer to the confirmation call | no |
| `customer_no_show` | driver arrived, nobody there or refused to pay | **yes** |
| `out_of_stock` | merchant cannot fulfil | no |
| `delivery_not_possible` | address unreachable, access problem | no |
| `damaged_in_transit` | arrived damaged | no |
| `merchant_error` | pricing, listing or production mistake | no |

`admin_note` is free text alongside the code. The code is for counting, the note
is for remembering.

## 5. Order events

Every status change writes an `order_events` row: `from_status`, `to_status`,
`actor_id`, `note`, `created_at`. `place_order` writes the opening row with
`from_status = null`.

The customer sees this as a timeline on their order — the status story, not a
log. The merchant sees the same rows with the internal notes attached.

This means: **never update an order status without an event.** Both happen inside
`advance_order_status`, in one transaction, so they cannot come apart.

## 6. Cash-on-delivery risk controls

The full reasoning is in ADR-007. Operationally:

- **The confirmation call is the verification.** `PENDING_CONFIRMATION` exists so
  no order enters production without a human agreeing it is real.
- **Value ceiling.** Above `ORDER_CONFIRMATION_THRESHOLD_MINOR` (default
  KES 50,000 → `5000000`), `CONFIRMED → IN_PRODUCTION` is refused unless the
  order carries a confirmation event with a note. The refusal explains itself.
- **No-show tracking.** Cancelling with `customer_no_show` increments
  `profiles.no_show_count`. Surfaced as a badge; never an automatic block.
- **Phone is required and normalised** to E.164 at checkout. Not verified —
  see ADR-007.

## 7. Pricing and totals

Computed only inside `place_order`:

    subtotal_minor      = Σ (unit_price_minor × qty)
    unit_price_minor    = products.base_price_minor + coalesce(variant.price_delta_minor, 0)
    delivery_fee_minor  = delivery_zones.fee_minor for the chosen zone, at placement time
    total_minor         = subtotal_minor + delivery_fee_minor

Every one of these is snapshotted onto the order. Later price changes, variant
renames and zone fee edits do not touch a placed order.

The cart shows an *estimate* using current prices and labels it as such. The
order shows the agreed amount. When they differ at checkout, the customer is
shown the change and must re-confirm — the total is never quietly corrected.

## 8. Stock and lead time

`stock_qty` is nullable. **Null means made to order**, not zero — furniture is
frequently built on demand, and a null must never render as "out of stock".

- `stock_qty IS NULL` → available, show `lead_time_days`
- `stock_qty > 0` → available, show as in stock
- `stock_qty = 0` → unavailable, block add-to-cart

There is **no stock reservation.** Two customers can order the last unit of the
same piece. `place_order` checks availability at placement, and the confirmation
call resolves the rest. Hard reservation is deliberately out of scope; adding it
later means a decrement inside `place_order` and a release on cancellation, both
inside the existing transaction.

A cart shows lead time per line, because one slow item changes the delivery
expectation for the whole order. Say that where the customer can see it.

## 9. What is deliberately not modelled

- Partial shipment. An order is delivered as one thing.
- Partial payment. Cash on delivery is paid in full or it is not paid.
- Refunds. There is no gateway; a return is settled in cash and recorded in the
  timeline.
- Discounts, coupons, tax lines. When tax arrives it is a snapshotted column on
  the order, computed in `place_order` like everything else.
