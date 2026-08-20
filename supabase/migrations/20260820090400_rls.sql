-- Row Level Security.
--
-- This is the authorization boundary. Middleware produces nicer redirects; it
-- protects nothing. Anyone holding the anon key — which ships in every browser —
-- can query PostgREST directly and never touch Next.js.
--
-- The hosted project has auto-generated APIs ON, so anon and authenticated
-- receive table privileges without an explicit GRANT. That makes the REVOKEs in
-- this file load-bearing rather than decorative: they are the reason a customer
-- cannot INSERT an order even before a policy is consulted.
--
-- auth.uid() is wrapped in a scalar subquery throughout. Postgres then
-- evaluates it once per statement as an InitPlan instead of once per row.

-- ---------------------------------------------------------------------------
-- RLS on. Every table. No exceptions, including lookup tables.
-- ---------------------------------------------------------------------------

alter table public.profiles                  enable row level security;
alter table public.addresses                 enable row level security;
alter table public.delivery_zones            enable row level security;
alter table public.categories                enable row level security;
alter table public.products                  enable row level security;
alter table public.product_variants          enable row level security;
alter table public.media_assets              enable row level security;
alter table public.carts                     enable row level security;
alter table public.cart_items                enable row level security;
alter table public.order_status_transitions  enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_events              enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges
--
-- Admins authenticate as the same Postgres role as customers — `authenticated`
-- — so grants cannot distinguish them. Anything an admin may do and a customer
-- may not is separated by a policy calling is_admin(), or by an RPC.
-- ---------------------------------------------------------------------------

-- Orders, their lines and their timeline are written only by SECURITY DEFINER
-- functions. Removing the privilege entirely means a mistake in a policy cannot
-- open a write path. See ADR-002.
revoke insert, update, delete, truncate on public.orders       from anon, authenticated;
revoke insert, update, delete, truncate on public.order_items  from anon, authenticated;
revoke insert, update, delete, truncate on public.order_events from anon, authenticated;

-- The transition table is reference data. It is read by everyone and written by
-- a migration.
revoke insert, update, delete, truncate on public.order_status_transitions from anon, authenticated;

-- A profile row is created by a trigger and removed with its auth user.
revoke insert, delete, truncate on public.profiles from anon, authenticated;

-- Nothing anonymous has any business with a person's data.
revoke all on public.profiles   from anon;
revoke all on public.addresses  from anon;
revoke all on public.carts      from anon;
revoke all on public.cart_items from anon;

-- An admin editing a customer's cart is not a feature. The absence is deliberate.
revoke all on public.carts      from anon;
revoke all on public.cart_items from anon;

-- Order numbers are allocated inside place_order and nowhere else.
revoke all on sequence public.order_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin reads all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- The role column is guarded by profiles_guard_role_change, not by this policy.
-- A policy cannot express "this row but not this column" well enough to rely on.
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admin updates any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------

create policy "addresses: own"
  on public.addresses for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "addresses: admin reads all"
  on public.addresses for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- categories, delivery_zones, order_status_transitions
-- ---------------------------------------------------------------------------

create policy "categories: public read"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "categories: admin writes"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "delivery_zones: public read active"
  on public.delivery_zones for select
  to anon, authenticated
  using (active);

create policy "delivery_zones: admin writes"
  on public.delivery_zones for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "transitions: public read"
  on public.order_status_transitions for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create policy "products: public read published"
  on public.products for select
  to anon, authenticated
  using (status = 'published');

create policy "products: admin all"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- product_variants, media_assets — visibility follows the parent product
-- ---------------------------------------------------------------------------

create policy "variants: public read when parent published"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.status = 'published'
    )
  );

create policy "variants: admin all"
  on public.product_variants for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "media: public read when parent published"
  on public.media_assets for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = media_assets.product_id
        and p.status = 'published'
    )
  );

create policy "media: admin all"
  on public.media_assets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- carts
-- ---------------------------------------------------------------------------

create policy "carts: own"
  on public.carts for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cart_items: own"
  on public.cart_items for all
  to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id
        and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- orders — SELECT only, for everyone. There is no INSERT or UPDATE policy on
-- this table by design, and adding one is a build failure.
-- ---------------------------------------------------------------------------

create policy "orders: read own"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "orders: admin reads all"
  on public.orders for select
  to authenticated
  using (public.is_admin());

create policy "order_items: read when the order is readable"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = (select auth.uid()) or public.is_admin())
    )
  );

create policy "order_events: read when the order is readable"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and (o.user_id = (select auth.uid()) or public.is_admin())
    )
  );
