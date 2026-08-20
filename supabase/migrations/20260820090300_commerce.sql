-- Commerce: carts, orders, order items, and the order timeline.

-- ---------------------------------------------------------------------------
-- carts
-- ---------------------------------------------------------------------------

-- Server-backed so a cart survives a device change. Guests keep a local cart
-- that merges in on sign-in; the merge sums quantities and says so.
create table public.carts (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id         uuid primary key default extensions.gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  qty        integer not null check (qty > 0 and qty <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULLS NOT DISTINCT so a second "no variant" line for the same product
-- collides instead of quietly duplicating. Without it, NULL <> NULL and the
-- unique constraint does nothing for exactly the common case.
create unique index cart_items_unique_line
  on public.cart_items (cart_id, product_id, variant_id)
  nulls not distinct;

create index cart_items_cart_idx on public.cart_items (cart_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_status_transitions
-- ---------------------------------------------------------------------------

-- The state machine as data, not as a CASE statement. advance_order_status
-- reads this; src/lib/orders/transitions.ts mirrors it for the UI so the admin
-- is offered exactly the legal next steps and never a free-form dropdown.
create table public.order_status_transitions (
  from_status     public.order_status not null,
  to_status       public.order_status not null,
  requires_reason boolean not null default false,
  label           text not null,
  primary key (from_status, to_status),
  constraint order_status_transitions_not_self check (from_status <> to_status)
);

insert into public.order_status_transitions (from_status, to_status, requires_reason, label) values
  ('pending_confirmation', 'confirmed',          false, 'Confirm order'),
  ('pending_confirmation', 'cancelled',          true,  'Cancel order'),
  ('confirmed',            'in_production',      false, 'Start production'),
  ('confirmed',            'cancelled',          true,  'Cancel order'),
  ('in_production',        'ready_for_delivery', false, 'Mark ready'),
  ('in_production',        'cancelled',          true,  'Cancel order'),
  ('ready_for_delivery',   'out_for_delivery',   false, 'Send out for delivery'),
  ('ready_for_delivery',   'cancelled',          true,  'Cancel order'),
  ('out_for_delivery',     'delivered',          false, 'Mark delivered'),
  -- A failed delivery attempt is routine. It must not need a cancellation to
  -- be modelled.
  ('out_for_delivery',     'ready_for_delivery', false, 'Delivery attempt failed'),
  ('out_for_delivery',     'cancelled',          true,  'Cancel order'),
  ('delivered',            'returned',           true,  'Record return');

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq;

create table public.orders (
  id                  uuid primary key default extensions.gen_random_uuid(),

  -- Customers read this over the phone. It is not the primary key.
  order_number        text not null unique,

  -- restrict, not cascade: deleting a customer who has order history should
  -- fail loudly rather than erase the business record.
  user_id             uuid not null references public.profiles (id) on delete restrict,

  status              public.order_status not null default 'pending_confirmation',
  payment_status      public.payment_status not null default 'unpaid',
  cancellation_reason public.cancellation_reason,

  subtotal_minor      bigint not null check (subtotal_minor >= 0),
  delivery_fee_minor  bigint not null check (delivery_fee_minor >= 0),
  total_minor         bigint not null check (total_minor >= 0),
  currency            char(3) not null default 'KES',

  -- A snapshot, not a foreign key. Editing a saved address must not rewrite
  -- where a delivered order actually went.
  delivery_address    jsonb not null,
  delivery_zone_name  text not null,

  contact_phone       text not null,
  customer_note       text,
  admin_note          text,

  -- Kills the double-submit. Uniqueness is what makes it safe, not the control
  -- flow inside place_order.
  idempotency_key     text not null unique,

  placed_at           timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint orders_total_is_the_sum
    check (total_minor = subtotal_minor + delivery_fee_minor),

  -- Cash is collected on delivery. Paid before delivered is not a state that
  -- exists, and asserting that here is cheaper than trusting every writer.
  constraint orders_paid_only_when_delivered
    check (payment_status <> 'paid' or status = 'delivered'),

  -- Every ending has a reason code, because the reasons are counted.
  constraint orders_terminal_states_have_a_reason
    check (status not in ('cancelled', 'returned') or cancellation_reason is not null),

  constraint orders_contact_phone_e164
    check (contact_phone ~ '^\+[1-9]\d{7,14}$'),

  constraint orders_delivery_address_is_object
    check (jsonb_typeof(delivery_address) = 'object')
);

create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_number_idx on public.orders (order_number);
create index orders_phone_idx on public.orders (contact_phone);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- FRN-2026-0417. Sequence-backed, so two concurrent checkouts cannot collide.
--
-- Deliberately NOT security definer. It runs as the caller, and `authenticated`
-- has no USAGE on order_number_seq (revoked in the RLS migration). The effect is
-- that an order cannot be minted by a direct INSERT even if someone later adds
-- an INSERT policy to orders by mistake — the privilege and the policy are two
-- independent locks. place_order is security definer and runs as the owner, so
-- it draws numbers without trouble.
create or replace function public.assign_order_number()
  returns trigger
  language plpgsql
  set search_path = ''
as $fn$
begin
  if new.order_number is null then
    new.order_number :=
      'FRN-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$fn$;

create trigger orders_assign_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------

-- Every column ending _snapshot is a copy of what the customer agreed to.
-- Renaming a product or raising its price must never rewrite history.
create table public.order_items (
  id               uuid primary key default extensions.gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,

  -- set null, not cascade: products are archived rather than deleted, but if
  -- one ever does go, the line survives on its snapshots.
  product_id       uuid references public.products (id) on delete set null,
  variant_id       uuid references public.product_variants (id) on delete set null,

  name_snapshot    text not null,
  variant_snapshot text,
  image_snapshot   text,

  unit_price_minor bigint not null check (unit_price_minor >= 0),
  qty              integer not null check (qty > 0),
  line_total_minor bigint not null check (line_total_minor >= 0),

  created_at       timestamptz not null default now(),

  constraint order_items_line_total_is_the_product
    check (line_total_minor = unit_price_minor * qty),
  constraint order_items_name_snapshot_present
    check (length(trim(name_snapshot)) > 0)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- order_events
-- ---------------------------------------------------------------------------

-- Not an audit log. This is the status story the customer reads on their order,
-- and the follow-up trail the merchant works from. Never change a status
-- without writing one of these, which is why both happen inside one function.
create table public.order_events (
  id          uuid primary key default extensions.gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  from_status public.order_status,     -- null on the opening event
  to_status   public.order_status not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);
