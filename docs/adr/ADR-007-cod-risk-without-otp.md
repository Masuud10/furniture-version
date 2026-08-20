# ADR-007 — Cash-on-delivery risk control without phone OTP

**Status:** Accepted · 2026-08-20
**Supersedes:** the phone-verification requirement in the original brief

## Context

Cash on delivery moves the entire risk of a fake order onto the merchant. A
no-show on a made-to-order wardrobe is not a lost sale, it is a built wardrobe
nobody wants.

The brief specified Supabase phone OTP before a first order. That would have been
the only paid dependency in the build, and it has been dropped by decision. The
risk it was covering has not gone anywhere, so the remaining controls have to
carry it.

## Decision

No SMS. No OTP. No half-built verification path behind a flag — an unreachable
code path rots and gives false comfort. `profiles.phone_verified` **stays in the
schema**, defaulting to `false`, so reintroducing verification is a feature, not
a migration.

The controls that carry the risk instead:

1. **`PENDING_CONFIRMATION` is the entry state and it means something.** No order
   reaches `IN_PRODUCTION` without a human advancing it. The merchant calls, the
   call is the verification, and the call is recorded as an `order_events` row.
   This is stronger than an OTP: it verifies intent, not just handset possession.
2. **A value ceiling makes that call mandatory.** Above
   `ORDER_CONFIRMATION_THRESHOLD_MINOR`, the admin UI refuses to advance to
   `IN_PRODUCTION` until a confirmation event with a note exists on the order.
3. **Cancellation requires a reason code.** `customer_no_show` increments
   `profiles.no_show_count`.
4. **`no_show_count` is surfaced, not hidden.** A badge on the customer, on the
   orders board and on the order detail. The merchant decides what to do with it;
   the system does not silently block anyone.
5. **Contact phone is normalised and required at checkout,** E.164, validated by
   the shared schema. Unreachable is not the same as unverified, but a malformed
   number is caught before the order exists.

## Consequences

- A determined bad actor can place an order with a working number they do not
  answer. The confirmation call catches it before production, which is where the
  cost actually is.
- The merchant does more phone work. That matches how this business already runs,
  and the timeline makes the work visible rather than remembered.
- `phone_verified` is dead weight in the schema until it is not. One boolean.
- The customer-facing copy must be honest about the call: "We will call you
  within a day to confirm before production starts." It is a step in the process,
  not an apology.

## Reintroducing OTP later

Wire an SMS provider in Supabase Auth, add the verify step to signup and to
checkout, gate `place_order` on `phone_verified` with a single added condition,
and start writing `true`. The schema, the copy slot and the check location all
already exist.

## Rejected alternatives

**Feature-flagged OTP, off.** Builds a path nobody exercises, which means it is
broken by the time it is switched on, while the flag being off reads as "almost
done". Rejected in favour of an honest absence.

**Requiring a deposit.** Would genuinely solve it, and requires a payment
gateway, which this build does not have. Out of scope by definition.

**Blocking customers automatically above a no-show count.** Punishes a delivery
that failed for the merchant reason as if it were fraud. Surface the number, let
a person judge. Rejected.
