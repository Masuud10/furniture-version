-- The write path.
--
-- Every function here is SECURITY DEFINER with an empty search_path and does its
-- own authorization check in the first lines of its body, because SECURITY
-- DEFINER bypasses RLS. See ADR-002 and docs/security.md section 3.

-- ---------------------------------------------------------------------------
-- shop_settings — one row, because the value ceiling has to live somewhere the
-- database can read it. An env var cannot be consulted from inside a function.
-- ---------------------------------------------------------------------------

create table public.shop_settings (
  id                                 boolean primary key default true,
  -- Above this order total, an admin must record a confirmation call before
  -- production can start. KES 50,000 in cents. See ADR-007.
  order_confirmation_threshold_minor bigint not null default 5000000
                                       check (order_confirmation_threshold_minor >= 0),
  updated_at                         timestamptz not null default now(),

  constraint shop_settings_is_a_singleton check (id)
);

insert into public.shop_settings (id) values (true);

alter table public.shop_settings enable row level security;

revoke insert, delete, truncate on public.shop_settings from anon, authenticated;

create policy "settings: readable"
  on public.shop_settings for select
  to anon, authenticated
  using (true);

create policy "settings: admin writes"
  on public.shop_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- price_order_lines — internal
-- ---------------------------------------------------------------------------

-- Turns the client payload into priced, snapshotted lines, and reports why any
-- line is unacceptable rather than just dropping it.
--
-- Internal to place_order. It can see draft and archived products, so it is not
-- executable by any client role — the REVOKE below is the reason that is safe.
-- Duplicate lines are collapsed here, so ordering the same piece twice produces
-- one line with qty 2 rather than two lines.
create or replace function public.price_order_lines(p_items jsonb)
  returns table (
    product_id       uuid,
    variant_id       uuid,
    qty              integer,
    name_snapshot    text,
    variant_snapshot text,
    image_snapshot   text,
    unit_price_minor bigint,
    line_total_minor bigint,
    currency         char(3),
    product_missing  boolean,
    product_status   text,
    variant_missing  boolean,
    stock_shortfall  boolean,
    available_qty    integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $fn$
  with requested as (
    -- jsonb_to_recordset reads only the columns named here. An injected
    -- "unit_price_minor" or "total_minor" is discarded, not honoured.
    select i.product_id,
           i.variant_id,
           sum(i.qty)::integer as qty
    from jsonb_to_recordset(p_items)
         as i(product_id uuid, variant_id uuid, qty integer)
    group by i.product_id, i.variant_id
  )
  select
    r.product_id,
    r.variant_id,
    r.qty,
    p.name,
    v.name,
    (
      select m.storage_path
      from public.media_assets m
      where m.product_id = p.id
        and m.kind = 'image'
      order by m.is_primary desc, m.position asc
      limit 1
    ),
    p.base_price_minor + coalesce(v.price_delta_minor, 0),
    (p.base_price_minor + coalesce(v.price_delta_minor, 0)) * r.qty,
    p.currency,
    p.id is null,
    p.status,
    r.variant_id is not null and v.id is null,
    coalesce(v.stock_qty, p.stock_qty) is not null
      and coalesce(v.stock_qty, p.stock_qty) < r.qty,
    coalesce(v.stock_qty, p.stock_qty)
  from requested r
  left join public.products p
    on p.id = r.product_id
  left join public.product_variants v
    on v.id = r.variant_id
   and v.product_id = r.product_id;
$fn$;

comment on function public.price_order_lines(jsonb) is
  'Internal to place_order. Prices and snapshots a payload. Not callable by any client role.';

revoke execute on function public.price_order_lines(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- place_order
-- ---------------------------------------------------------------------------

-- p_items is [{"product_id": uuid, "variant_id": uuid | null, "qty": int}].
--
-- There is no price field in that payload and there never will be. Prices are
-- re-read here, from the same tables the storefront renders from, and
-- snapshotted onto the order. A tampered client can change what is ordered; it
-- cannot change what it costs.
create or replace function public.place_order(
  p_idempotency_key text,
  p_address_id      uuid,
  p_items           jsonb,
  p_customer_note   text default null
)
  returns public.orders
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_user     uuid := (select auth.uid());
  v_order    public.orders;
  v_address  public.addresses;
  v_zone     public.delivery_zones;
  v_bad      record;
  v_currency     char(3);
  v_currency_max char(3);
  v_subtotal     bigint;
  v_lines        integer;
begin
  ------------------------------------------------------------------ authorize
  if v_user is null then
    raise exception 'Sign in to place an order.' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Missing idempotency key.' using errcode = '22023';
  end if;

  ---------------------------------------------------------------- idempotency
  -- Scoped to the user as well as the key, so one customer cannot fish for
  -- another customer's order by guessing a key.
  select * into v_order
  from public.orders
  where idempotency_key = p_idempotency_key
    and user_id = v_user;

  if found then
    return v_order;
  end if;

  -------------------------------------------------------------------- address
  select * into v_address
  from public.addresses
  where id = p_address_id
    and user_id = v_user;

  if not found then
    raise exception 'That delivery address does not exist.' using errcode = '42501';
  end if;

  if v_address.delivery_zone_id is null then
    raise exception 'Choose a delivery area for this address before ordering.'
      using errcode = '23514';
  end if;

  select * into v_zone
  from public.delivery_zones
  where id = v_address.delivery_zone_id
    and active;

  if not found then
    raise exception 'We are not delivering to that area at the moment.'
      using errcode = '23514';
  end if;

  ---------------------------------------------------------------------- items
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;

  ------------------------------------------------------------------- validate
  -- One pass, most specific complaint first, phrased for the person reading it.
  select * into v_bad
  from public.price_order_lines(p_items) l
  where l.product_id is null
     or l.qty is null or l.qty < 1 or l.qty > 99
     or l.product_missing
     or l.product_status is distinct from 'published'
     or l.variant_missing
     or l.stock_shortfall
  order by l.product_missing desc, l.variant_missing desc
  limit 1;

  if found then
    if v_bad.product_id is null then
      raise exception 'An item in your cart is missing a product.' using errcode = '22023';
    elsif v_bad.qty is null or v_bad.qty < 1 or v_bad.qty > 99 then
      raise exception 'Quantities must be between 1 and 99.' using errcode = '22023';
    elsif v_bad.product_missing then
      raise exception 'One of those pieces is no longer listed.' using errcode = '23503';
    elsif v_bad.product_status is distinct from 'published' then
      raise exception '% is not available to order.', coalesce(v_bad.name_snapshot, 'That piece')
        using errcode = '23514';
    elsif v_bad.variant_missing then
      raise exception 'That option is not available for %.', v_bad.name_snapshot
        using errcode = '23503';
    else
      -- available_qty is 0 here whenever the piece is simply gone. NULL stock
      -- means made to order and never reaches this branch.
      raise exception 'We only have % of % left.', v_bad.available_qty, v_bad.name_snapshot
        using errcode = '23514';
    end if;
  end if;

  select count(*), sum(l.line_total_minor), min(l.currency), max(l.currency)
  into v_lines, v_subtotal, v_currency, v_currency_max
  from public.price_order_lines(p_items) l;

  if v_lines = 0 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;

  if v_currency is distinct from v_currency_max then
    raise exception 'An order cannot mix currencies.' using errcode = '23514';
  end if;

  --------------------------------------------------------------------- write
  begin
    insert into public.orders (
      user_id, status, payment_status,
      subtotal_minor, delivery_fee_minor, total_minor, currency,
      delivery_address, delivery_zone_name, contact_phone,
      customer_note, idempotency_key
    )
    values (
      v_user, 'pending_confirmation', 'unpaid',
      v_subtotal, v_zone.fee_minor, v_subtotal + v_zone.fee_minor,
      coalesce(v_currency, 'KES'),
      jsonb_build_object(
        'label',          v_address.label,
        'recipient_name', v_address.recipient_name,
        'phone',          v_address.phone,
        'line1',          v_address.line1,
        'line2',          v_address.line2,
        'city',           v_address.city,
        'region',         v_address.region,
        'landmark',       v_address.landmark,
        'zone',           v_zone.name
      ),
      v_zone.name,
      v_address.phone,
      nullif(trim(coalesce(p_customer_note, '')), ''),
      p_idempotency_key
    )
    returning * into v_order;
  exception
    when unique_violation then
      -- Two clicks arriving together. The constraint decided the winner; this
      -- branch just hands back what it wrote.
      select * into v_order
      from public.orders
      where idempotency_key = p_idempotency_key
        and user_id = v_user;

      if found then
        return v_order;
      end if;
      raise;
  end;

  insert into public.order_items (
    order_id, product_id, variant_id,
    name_snapshot, variant_snapshot, image_snapshot,
    unit_price_minor, qty, line_total_minor
  )
  select v_order.id, l.product_id, l.variant_id,
         l.name_snapshot, l.variant_snapshot, l.image_snapshot,
         l.unit_price_minor, l.qty, l.line_total_minor
  from public.price_order_lines(p_items) l;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (v_order.id, v_user, null, 'pending_confirmation', 'Order placed.');

  return v_order;
end;
$fn$;

comment on function public.place_order(text, uuid, jsonb, text) is
  'Places an order. Re-reads prices server-side; the payload carries no price. Idempotent on (user, key).';

revoke execute on function public.place_order(text, uuid, jsonb, text) from public, anon;
grant execute on function public.place_order(text, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- advance_order_status
-- ---------------------------------------------------------------------------

-- Deviation from the brief: p_reason is added. Cancellation requires a reason
-- code, and a function that cannot accept one cannot enforce that.
create or replace function public.advance_order_status(
  p_order_id uuid,
  p_to       public.order_status,
  p_note     text default null,
  p_reason   public.cancellation_reason default null
)
  returns public.orders
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_actor      uuid := (select auth.uid());
  v_order      public.orders;
  v_transition public.order_status_transitions;
  v_threshold  bigint;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Only an admin can change an order status.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'That order does not exist.' using errcode = '23503';
  end if;

  select * into v_transition
  from public.order_status_transitions
  where from_status = v_order.status
    and to_status = p_to;

  if not found then
    raise exception 'An order cannot go from % to %.', v_order.status, p_to
      using errcode = '23514';
  end if;

  if v_transition.requires_reason and p_reason is null then
    raise exception 'Choose a reason before closing this order.' using errcode = '23514';
  end if;

  -- The confirmation call is the verification. Above the ceiling it is not
  -- optional, and "confirmed" without a note is not evidence a call happened.
  if p_to = 'in_production' then
    select order_confirmation_threshold_minor into v_threshold from public.shop_settings limit 1;

    if v_order.total_minor > coalesce(v_threshold, 0)
       and not exists (
         select 1 from public.order_events e
         where e.order_id = v_order.id
           and e.to_status = 'confirmed'
           and length(trim(coalesce(e.note, ''))) > 0
       )
    then
      raise exception
        'This order is over the confirmation limit. Call the customer and record what they said before starting production.'
        using errcode = '23514';
    end if;
  end if;

  update public.orders
  set status = p_to,
      cancellation_reason = case
        when p_to in ('cancelled', 'returned') then p_reason
        else cancellation_reason
      end
  where id = v_order.id
  returning * into v_order;

  -- A status change and its event are written together or not at all. That is
  -- the whole reason this is one function.
  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (v_order.id, v_actor, v_transition.from_status, p_to,
          nullif(trim(coalesce(p_note, '')), ''));

  if p_to = 'cancelled' and p_reason = 'customer_no_show' then
    update public.profiles
    set no_show_count = no_show_count + 1
    where id = v_order.user_id;
  end if;

  return v_order;
end;
$fn$;

comment on function public.advance_order_status(uuid, public.order_status, text, public.cancellation_reason) is
  'Admin-only. Enforces order_status_transitions and writes the timeline event in the same transaction.';

revoke execute on function public.advance_order_status(uuid, public.order_status, text, public.cancellation_reason) from public, anon;
grant execute on function public.advance_order_status(uuid, public.order_status, text, public.cancellation_reason) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_order_paid
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_paid(p_order_id uuid)
  returns public.orders
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_order public.orders;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Only an admin can record a payment.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'That order does not exist.' using errcode = '23503';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'Cash is collected on delivery. Mark the order delivered first.'
      using errcode = '23514';
  end if;

  if v_order.payment_status = 'paid' then
    return v_order;
  end if;

  update public.orders
  set payment_status = 'paid'
  where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, actor_id, from_status, to_status, note)
  values (v_order.id, v_actor, v_order.status, v_order.status, 'Cash received.');

  return v_order;
end;
$fn$;

revoke execute on function public.mark_order_paid(uuid) from public, anon;
grant execute on function public.mark_order_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_order_admin_note
-- ---------------------------------------------------------------------------

-- orders has no UPDATE privilege for anyone, so the internal note needs its own
-- door rather than an exception to that rule.
create or replace function public.set_order_admin_note(p_order_id uuid, p_note text)
  returns public.orders
  language plpgsql
  security definer
  set search_path = ''
as $fn$
declare
  v_order public.orders;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an admin can write an internal note.' using errcode = '42501';
  end if;

  update public.orders
  set admin_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'That order does not exist.' using errcode = '23503';
  end if;

  return v_order;
end;
$fn$;

revoke execute on function public.set_order_admin_note(uuid, text) from public, anon;
grant execute on function public.set_order_admin_note(uuid, text) to authenticated;
