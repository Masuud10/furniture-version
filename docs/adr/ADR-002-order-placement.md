# ADR-002 — Order placement is a SECURITY DEFINER Postgres function

**Status:** Accepted · 2026-08-20

## Context

Placing an order must re-read authoritative prices, snapshot them, compute a
total, create an order and its items, write the opening timeline event, and do
all of that exactly once even when the customer double-clicks — atomically.

The client cannot be trusted with any of it. A Next.js server action could do the
work, but a server action writing across five tables without a transaction is a
correctness problem, and `supabase-js` has no transaction API. Opening a direct
Postgres connection from a route handler would mean a second data access path
with a second authorization story.

## Decision

Two Postgres functions, both `SECURITY DEFINER` with an empty `search_path`:

    place_order(p_idempotency_key text, p_address_id uuid, p_items jsonb) returns orders
    advance_order_status(p_order_id uuid, p_to order_status, p_note text) returns orders

`p_items` carries `{product_id, variant_id, qty}` and nothing else. There is no
price field in the payload, so there is nothing for a client to tamper with.

`place_order` must:

- re-read every price from `products` and `product_variants`
- reject products that are not `published`
- snapshot name, variant name, primary image and unit price into `order_items`
- compute subtotal, delivery fee and total server-side
- write the opening `order_events` row
- return the existing order unchanged if the idempotency key was already used
- run in one transaction

`orders` has **no INSERT policy for customers at all**. The only way an order
comes into existence is through this function.

## Consequences

- The invariant is enforced at the last possible layer, so it holds for every
  caller — the web app now, a Flutter app later, a support script, psql.
- Business logic lives in SQL. That is less pleasant to test than TypeScript,
  which is why the pgTAP suite is treated as a deliverable rather than an
  afterthought.
- `SECURITY DEFINER` runs as the function owner and bypasses RLS inside its body.
  Every such function therefore must pin `search_path` to empty, so a hostile
  `search_path` cannot shadow a table name, and must do its own authorization
  check on `auth.uid()` in the first lines of the body.
- Changing the ordering rules means a migration, not a deploy. Slower, and
  correctly so.
- The idempotency key is client-generated, one UUID per checkout attempt, and
  carries a unique constraint. Uniqueness is what makes the double-click safe,
  not the control flow inside the function.

## Rejected alternatives

**Server action doing sequential inserts.** No transaction. A failure between the
`orders` insert and the `order_items` insert leaves a customer with an empty
order and the merchant with a phantom row. Rejected.

**Edge Function.** Another runtime, another deploy target, another place for the
service key to live — and it still needs a transaction to be correct, so it would
end up calling this same function. Rejected.

**Client insert with a BEFORE INSERT trigger that overwrites the price.** Works
for pricing, but cannot express idempotency or multi-row atomicity, and leaves an
INSERT policy on `orders` that has to be exactly right forever. Rejected.
