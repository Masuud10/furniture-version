-- Hostile RLS tests.
--
-- Every block below authenticates AS a role and asserts what must fail. A test
-- that passes when it should fail is a broken test, not a green build.
--
-- Role switching is done with top-level SET LOCAL rather than a helper
-- function, because a SET inside a function does not reliably outlive the call
-- and a test that silently runs as the wrong role proves nothing.
--
-- RESET ROLE returns to the session user (the owner) and is needed before each
-- switch, since `authenticated` may not SET ROLE to anything else.
--
--   admin  11111111-1111-1111-1111-111111111111  Amina
--   joy    22222222-2222-2222-2222-222222222222  customer A
--   peter  33333333-3333-3333-3333-333333333333  customer B

begin;

-- ===========================================================================
-- anon — holds the key that ships in every browser
-- ===========================================================================

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select tests.blocked('select * from public.profiles',    'anon cannot read any profile');
select tests.blocked('select * from public.addresses',   'anon cannot read any address');
select tests.blocked('select * from public.orders',      'anon cannot read any order');
select tests.blocked('select * from public.order_items', 'anon cannot read any order line');
select tests.blocked('select * from public.order_events','anon cannot read any timeline event');
select tests.blocked('select * from public.carts',       'anon cannot read any cart');
select tests.blocked('select * from public.cart_items',  'anon cannot read any cart line');

select tests.blocked(
  'select * from public.products where status <> ''published''',
  'anon cannot read draft or archived products');

select tests.blocked(
  'select v.* from public.product_variants v
     join public.products p on p.id = v.product_id
    where p.status <> ''published''',
  'anon cannot read variants of an unpublished product');

select tests.blocked(
  'select m.* from public.media_assets m
     join public.products p on p.id = m.product_id
    where p.status <> ''published''',
  'anon cannot read media of an unpublished product');

-- What anon SHOULD see. A suite that only proves things are hidden can be
-- satisfied by a schema that shows nothing to anyone.
select tests.ok(
  (select count(*) from public.products) = 11,
  'anon sees all 11 published products');
select tests.ok(
  (select count(*) from public.categories) = 3,
  'anon sees the categories');
select tests.ok(
  (select count(*) from public.delivery_zones) = 4,
  'anon sees only active delivery zones');

select tests.throws(
  'insert into storage.objects (bucket_id, name) values (''product-media'', ''hack.jpg'')',
  'anon cannot upload product media', '42501');

select tests.throws(
  'insert into public.orders (user_id, subtotal_minor, delivery_fee_minor, total_minor,
     delivery_address, delivery_zone_name, contact_phone, idempotency_key)
   values (''22222222-2222-2222-2222-222222222222'', 0, 0, 0, ''{}''::jsonb, ''z'', ''+254700000000'', ''x'')',
  'anon cannot insert an order', '42501');

-- ===========================================================================
-- customer A (Joy) — the ordinary signed-in case
-- ===========================================================================

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Sees her own, and only her own.
select tests.ok(
  (select count(*) from public.orders) = 5,
  'customer A sees her own 5 orders');
select tests.blocked(
  'select * from public.orders where user_id = ''33333333-3333-3333-3333-333333333333''',
  'customer A cannot read customer B orders');
select tests.blocked(
  'select oi.* from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.user_id = ''33333333-3333-3333-3333-333333333333''',
  'customer A cannot read customer B order lines');
select tests.blocked(
  'select * from public.addresses where user_id = ''33333333-3333-3333-3333-333333333333''',
  'customer A cannot read customer B addresses');
select tests.blocked(
  'select * from public.profiles where id = ''33333333-3333-3333-3333-333333333333''',
  'customer A cannot read customer B profile');
select tests.blocked(
  'select * from public.carts where user_id <> ''22222222-2222-2222-2222-222222222222''',
  'customer A cannot read another cart');

-- order_events is the timeline the customer reads. It must be scoped the same
-- way the order is, or the status story leaks.
select tests.blocked(
  'select e.* from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.user_id = ''33333333-3333-3333-3333-333333333333''',
  'customer A cannot read customer B timeline');

select tests.ok(
  (select count(*) from public.order_events) > 0,
  'customer A can read her own timeline');

-- Orders are written only by place_order. There is no INSERT policy on this
-- table and the privilege itself is revoked.
select tests.throws(
  'insert into public.orders (user_id, subtotal_minor, delivery_fee_minor, total_minor,
     delivery_address, delivery_zone_name, contact_phone, idempotency_key)
   values (''22222222-2222-2222-2222-222222222222'', 1, 0, 1, ''{}''::jsonb, ''z'', ''+254700000000'', ''forged'')',
  'customer cannot insert an order directly', '42501');

-- Assert the outcome, not just that something was raised. Mutation testing
-- showed the exception above can come from either of two barriers; what the
-- customer must never end up with is a row.
select tests.eq(
  'select count(*)::text from public.orders where idempotency_key = ''forged''',
  '0', 'no forged order landed');

-- Defence in depth, found by mutation testing and worth pinning down.
--
-- assign_order_number() is a plain trigger function, so it runs as the caller.
-- `authenticated` has no USAGE on order_number_seq, which means an order cannot
-- be minted even if someone later adds an INSERT policy to orders by mistake.
-- Removing the policy alone is not what keeps this shut; both are.
select tests.throws(
  'select nextval(''public.order_number_seq'')',
  'a customer cannot draw an order number', '42501');

select tests.throws(
  'update public.orders set status = ''delivered''',
  'customer cannot advance her own order status', '42501');

select tests.throws(
  'update public.orders set payment_status = ''paid''',
  'customer cannot mark her own order paid', '42501');

select tests.throws(
  'update public.orders set total_minor = 1',
  'customer cannot rewrite her own order total', '42501');

select tests.throws(
  'delete from public.orders',
  'customer cannot delete an order', '42501');

select tests.throws(
  'insert into public.order_items (order_id, name_snapshot, unit_price_minor, qty, line_total_minor)
   select id, ''free sofa'', 0, 1, 0 from public.orders limit 1',
  'customer cannot add a line to an order', '42501');

select tests.throws(
  'insert into public.order_events (order_id, to_status) select id, ''delivered'' from public.orders limit 1',
  'customer cannot forge a timeline event', '42501');

-- Privilege escalation, the one that matters most.
select tests.throws(
  'update public.profiles set role = ''admin'' where id = ''22222222-2222-2222-2222-222222222222''',
  'customer cannot make themselves an admin', '42501');

-- This one does not raise: the UPDATE policy scopes the row to auth.uid(), so
-- the statement matches nothing and reports success. Nothing changed, which is
-- the property that matters. Asserted twice — no write, and the role is still
-- what it was.
select tests.writes_nothing(
  'update public.profiles set role = ''admin'' where id = ''33333333-3333-3333-3333-333333333333''',
  'customer cannot make someone else an admin');

-- The rest of the row is theirs to edit.
select tests.lives(
  'update public.profiles set full_name = ''Joy K.'' where id = ''22222222-2222-2222-2222-222222222222''',
  'customer can edit their own name');

select tests.blocked(
  'select * from public.products where status <> ''published''',
  'customer cannot read draft products');

-- The admin-only RPCs.
select tests.throws(
  'select public.advance_order_status((select id from public.orders limit 1), ''confirmed'')',
  'customer cannot advance an order status through the RPC', '42501');

select tests.throws(
  'select public.mark_order_paid((select id from public.orders limit 1))',
  'customer cannot mark an order paid through the RPC', '42501');

select tests.throws(
  'select public.set_order_admin_note((select id from public.orders limit 1), ''hi'')',
  'customer cannot write an internal note', '42501');

-- price_order_lines can see unpublished products. It is internal to
-- place_order and must not be reachable from a client.
select tests.throws(
  'select * from public.price_order_lines(''[]''::jsonb)',
  'customer cannot call the internal pricing function', '42501');

-- ===========================================================================
-- customer B (Peter) — the mirror image, so a policy that hardcodes one user
-- cannot pass
-- ===========================================================================

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select tests.ok(
  (select count(*) from public.orders) = 3,
  'customer B sees his own 3 orders');

-- The escalation attempt customer A made against this account earlier changed
-- nothing. Checked from B's own session, not from the attacker's.
select tests.eq(
  'select role from public.profiles where id = ''33333333-3333-3333-3333-333333333333''',
  'customer', 'customer B is still a customer after A tried to promote him');
select tests.blocked(
  'select * from public.orders where user_id = ''22222222-2222-2222-2222-222222222222''',
  'customer B cannot read customer A orders');
select tests.blocked(
  'select * from public.cart_items',
  'customer B cannot read customer A cart lines');

-- ===========================================================================
-- admin
-- ===========================================================================

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select tests.ok(public.is_admin(), 'is_admin() is true for the admin');
select tests.ok(
  (select count(*) from public.orders) = 8,
  'admin sees every order');
select tests.ok(
  (select count(*) from public.profiles) = 3,
  'admin sees every profile');
select tests.ok(
  (select count(*) from public.products) = 13,
  'admin sees draft and archived products too');

select tests.lives(
  'update public.products set summary = ''Edited.'' where slug = ''meru-console''',
  'admin can edit a draft product');

select tests.lives(
  'update public.profiles set role = ''admin'' where id = ''33333333-3333-3333-3333-333333333333''',
  'admin can promote a customer');

-- Even an admin does not write orders by hand. The privilege is revoked from
-- the role, and admins authenticate as that same role.
select tests.throws(
  'update public.orders set status = ''delivered''',
  'admin cannot bypass the state machine with a bare UPDATE', '42501');

-- An admin has no policy on carts, so `select id from public.carts` returns
-- nothing and the insert writes nothing. The absence of admin cart access is
-- deliberate: editing a customer's cart is not a feature.
select tests.ok(
  (select count(*) from public.carts) = 0,
  'admin cannot see any customer cart');

select tests.writes_nothing(
  'insert into public.cart_items (cart_id, product_id, qty)
   select id, ''dddd0001-0000-4000-8000-000000000004'', 1 from public.carts limit 1',
  'admin cannot add to a customer cart');

select tests.throws(
  'insert into public.cart_items (cart_id, product_id, qty)
   values (''eeee0001-0000-4000-8000-000000000001'', ''dddd0001-0000-4000-8000-000000000004'', 1)',
  'admin cannot add to a customer cart named directly', '42501');

reset role;
select tests.finish();

rollback;
