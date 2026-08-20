# Security — RLS policy matrix and the hostile test suite

RLS is the authorization boundary. Middleware produces nicer redirects; it
protects nothing. Anyone holding the anon key — which ships in every browser —
can query Supabase directly and never touch Next.js.

**RLS is enabled on every table. No exceptions, including lookup tables.** A
table without RLS in this schema is a bug, and Phase 8 re-checks for tables that
appeared after this document was written.

---

## 1. Policy matrix

| Table | anon | customer | admin |
|---|---|---|---|
| `products` | SELECT where `status = 'published'` | same | ALL |
| `product_variants` | SELECT where parent published | same | ALL |
| `media_assets` | SELECT where parent published | same | ALL |
| `categories` | SELECT | SELECT | ALL |
| `delivery_zones` | SELECT where `active` | SELECT where `active` | ALL |
| `order_status_transitions` | SELECT | SELECT | SELECT |
| `profiles` | ✗ | SELECT/UPDATE own row, **cannot change `role`** | SELECT all, UPDATE all |
| `addresses` | ✗ | ALL where `user_id = auth.uid()` | SELECT all |
| `carts` | ✗ | ALL where `user_id = auth.uid()` | ✗ |
| `cart_items` | ✗ | ALL where parent cart is own | ✗ |
| `orders` | ✗ | SELECT own. **INSERT ✗, UPDATE ✗, DELETE ✗** | SELECT all. UPDATE via RPC only |
| `order_items` | ✗ | SELECT where parent order is own | SELECT all |
| `order_events` | ✗ | SELECT where parent order is own | ALL |
| `storage.objects` (`product-media`) | SELECT | SELECT | INSERT/UPDATE/DELETE |
| `storage.objects` (`product-drafts`) | ✗ | ✗ | ALL |

Admins are not given write access to `carts`. An admin editing a customer cart is
not a feature, and the absence is deliberate.

## 2. The two traps

**Recursion.** A policy on `profiles` that selects from `profiles` recurses.
Use `public.is_admin()`, a `SECURITY DEFINER` function with `search_path = ''`.
Full reasoning in ADR-005.

**Role escalation.** `UPDATE profiles USING (id = auth.uid())` lets a customer
set `role = 'admin'`. A policy cannot express "you may update this row but not
this column" cleanly enough to rely on. Enforce with a `BEFORE UPDATE` trigger
that raises when `new.role is distinct from old.role` and the actor is not
already an admin. Test it explicitly.

## 3. SECURITY DEFINER rules

Every `SECURITY DEFINER` function in this schema must:

1. `set search_path = ''` and schema-qualify every identifier. Without this, a
   caller controlling `search_path` can point `profiles` at a table they own.
2. Check `auth.uid()` in the first lines of its body. The function bypasses RLS,
   so it is responsible for its own authorization.
3. Be owned by a role the client cannot assume, and be `revoke execute … from
   public` then `grant execute … to authenticated` — never to `anon` unless it is
   genuinely public.

Current `SECURITY DEFINER` functions: `is_admin()`, `place_order()`,
`advance_order_status()`, `mark_order_paid()`, `handle_new_user()`.

## 4. Hostile test suite

pgTAP, in `supabase/tests/`. Each test authenticates **as** a role and asserts
what must fail. **A test that passes when it should fail is a broken test, not a
green build.**

Run: `supabase test db`

### Cross-customer isolation
- [ ] customer A cannot SELECT customer B's `orders`
- [ ] customer A cannot SELECT customer B's `order_items`
- [ ] customer A cannot SELECT customer B's `order_events`
- [ ] customer A cannot SELECT customer B's `addresses`
- [ ] customer A cannot SELECT or UPDATE customer B's `profiles` row
- [ ] customer A cannot read customer B's `cart_items`

### Order integrity
- [ ] customer cannot INSERT into `orders` directly
- [ ] customer cannot UPDATE `orders.status`
- [ ] customer cannot UPDATE `orders.payment_status`
- [ ] customer cannot UPDATE `orders.total_minor`
- [ ] customer cannot DELETE an order
- [ ] customer cannot INSERT into `order_items` or `order_events`

### Privilege
- [ ] customer cannot set their own `profiles.role` to `admin`
- [ ] customer cannot set another user's role
- [ ] non-admin calling `advance_order_status` is rejected
- [ ] non-admin calling `mark_order_paid` is rejected
- [ ] `anon` cannot SELECT any `profiles` row

### Catalogue exposure
- [ ] `anon` cannot SELECT `draft` or `archived` products
- [ ] `anon` cannot SELECT variants of an unpublished product
- [ ] `anon` cannot SELECT media of an unpublished product
- [ ] `anon` cannot SELECT any order, address, cart or profile

### place_order
- [ ] a tampered price in the payload produces the correct total anyway
- [ ] extra unexpected keys in the items payload are ignored, not honoured
- [ ] the same idempotency key twice creates exactly one order and returns it twice
- [ ] an unpublished product is rejected
- [ ] an archived product is rejected
- [ ] a variant belonging to a different product is rejected
- [ ] `qty <= 0` is rejected
- [ ] an address belonging to another user is rejected
- [ ] `subtotal + delivery_fee = total`, always
- [ ] the opening `order_events` row is written
- [ ] a product with `stock_qty = 0` is rejected; `stock_qty IS NULL` is accepted

### advance_order_status
- [ ] an illegal transition (`PENDING_CONFIRMATION → DELIVERED`) is rejected
- [ ] a transition out of `CANCELLED` is rejected
- [ ] a transition to the same status is rejected
- [ ] cancelling without a reason code is rejected
- [ ] `customer_no_show` increments `profiles.no_show_count`
- [ ] every accepted transition writes exactly one `order_events` row
- [ ] `mark_order_paid` on a non-`DELIVERED` order is rejected
- [ ] above the value ceiling, `CONFIRMED → IN_PRODUCTION` without a confirmation
      event is rejected

### Storage
- [ ] `anon` cannot write to `product-media`
- [ ] a customer cannot write to `product-media`
- [ ] `anon` cannot read `product-drafts`

## 5. Application-layer checks (Phase 8 verifies)

- No `SUPABASE_SERVICE_ROLE_KEY` in any client bundle. Grep the built output in
  `.next/static`, not the source.
- Zod validation at every server action and route handler boundary, with schemas
  shared between client and server.
- Rate limiting on auth endpoints and on `place_order`, per user and per IP.
- Every admin page performs a server-side `is_admin()` check in addition to
  middleware.
- No error message reveals whether an account exists.
- No raw Postgres error reaches a user.
