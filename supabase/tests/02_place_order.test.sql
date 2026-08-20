-- place_order: the function that decides what a customer is charged.
--
-- The payload in these tests deliberately carries price fields. They are the
-- attack. Every assertion about a total is really an assertion that they were
-- ignored.

begin;

-- Fixture: give one published product zero stock, so "sold out" can be tested
-- against something a customer can otherwise see. Done as the owner, before
-- any role switch.
reset role;
update public.products set stock_qty = 0 where slug = 'karen-bench';

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- ===========================================================================
-- The price the client sends is not the price it pays
-- ===========================================================================

-- Nanyuki armchair 3,450,000 + Moss wool 80,000 = 3,530,000 per unit.
-- Two of them is 7,060,000. Zone fee is 150,000. Total must be 7,210,000
-- however loudly the payload insists otherwise.
do $$ begin perform public.place_order(
  'test-tampered-price',
  'bbbb0001-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', 'dddd0001-0000-4000-8000-000000000002',
      'variant_id', (select id from public.product_variants where sku = 'NAN-AC-MOS'),
      'qty', 2,
      -- Everything below is a lie and must be discarded.
      'unit_price_minor', 1,
      'line_total_minor', 1,
      'price', 1,
      'total_minor', 1,
      'delivery_fee_minor', 0
    )
  )
); end $$;

select tests.eq(
  'select subtotal_minor::text from public.orders where idempotency_key = ''test-tampered-price''',
  '7060000', 'place_order recomputes the subtotal from the products table');

select tests.eq(
  'select delivery_fee_minor::text from public.orders where idempotency_key = ''test-tampered-price''',
  '150000', 'place_order takes the delivery fee from the zone, not the payload');

select tests.eq(
  'select total_minor::text from public.orders where idempotency_key = ''test-tampered-price''',
  '7210000', 'place_order computes the total server-side');

select tests.eq(
  'select unit_price_minor::text from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-tampered-price''',
  '3530000', 'the line snapshots the real unit price, base plus variant delta');

select tests.ok(
  (select total_minor = subtotal_minor + delivery_fee_minor
   from public.orders where idempotency_key = 'test-tampered-price'),
  'subtotal plus delivery equals total');

-- Snapshots, so a later rename or price rise cannot rewrite history.
select tests.eq(
  'select name_snapshot from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-tampered-price''',
  'Nanyuki armchair', 'the product name is snapshotted onto the line');

select tests.eq(
  'select variant_snapshot from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-tampered-price''',
  'Moss wool', 'the variant name is snapshotted onto the line');

select tests.ok(
  (select image_snapshot is not null from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = 'test-tampered-price'),
  'the primary image is snapshotted onto the line');

-- The order opens in the state a human has to move it out of.
select tests.eq(
  'select status::text from public.orders where idempotency_key = ''test-tampered-price''',
  'pending_confirmation', 'a new order starts at pending_confirmation');

select tests.eq(
  'select payment_status::text from public.orders where idempotency_key = ''test-tampered-price''',
  'unpaid', 'a new order starts unpaid');

select tests.eq(
  'select count(*)::text from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.idempotency_key = ''test-tampered-price''',
  '1', 'place_order writes exactly one opening timeline event');

select tests.eq(
  'select to_status::text from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.idempotency_key = ''test-tampered-price''',
  'pending_confirmation', 'the opening event records the opening status');

select tests.ok(
  (select order_number ~ '^FRN-\d{4}-\d{4}$'
   from public.orders where idempotency_key = 'test-tampered-price'),
  'the order number is human-readable, not a uuid');

select tests.ok(
  (select delivery_address ? 'line1' and delivery_address ? 'zone'
   from public.orders where idempotency_key = 'test-tampered-price'),
  'the delivery address is snapshotted as an object, not a foreign key');

-- ===========================================================================
-- Idempotency — a double-click is one order
-- ===========================================================================

do $$ begin perform public.place_order(
  'test-tampered-price',
  'bbbb0001-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object(
    'product_id', 'dddd0001-0000-4000-8000-000000000002', 'qty', 1))
); end $$;

select tests.eq(
  'select count(*)::text from public.orders where idempotency_key = ''test-tampered-price''',
  '1', 'the same idempotency key twice creates exactly one order');

-- And the second call returns the first order rather than an error, so the UI
-- can land on the confirmation page either way.
select tests.eq(
  'select (public.place_order(''test-tampered-price'',
     ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000002'', ''qty'', 1)))).total_minor::text',
  '7210000', 'a repeated call returns the original order unchanged');

-- Nothing was appended to the first order either.
select tests.eq(
  'select count(*)::text from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-tampered-price''',
  '1', 'a repeated call does not append lines to the existing order');

-- ===========================================================================
-- Duplicate lines collapse
-- ===========================================================================

do $$ begin perform public.place_order(
  'test-duplicate-lines',
  'bbbb0001-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object('product_id', 'dddd0001-0000-4000-8000-000000000008', 'qty', 1),
    jsonb_build_object('product_id', 'dddd0001-0000-4000-8000-000000000008', 'qty', 2)
  )
); end $$;

select tests.eq(
  'select count(*)::text from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-duplicate-lines''',
  '1', 'the same piece listed twice becomes one line');

select tests.eq(
  'select qty::text from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.idempotency_key = ''test-duplicate-lines''',
  '3', 'the collapsed line carries the summed quantity');

-- ===========================================================================
-- What must be refused
-- ===========================================================================

select tests.throws(
  'select public.place_order(''t-draft'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-00000000000c'', ''qty'', 1)))',
  'a draft product cannot be ordered', '23514');

select tests.throws(
  'select public.place_order(''t-archived'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-00000000000d'', ''qty'', 1)))',
  'an archived product cannot be ordered', '23514');

select tests.throws(
  'select public.place_order(''t-sold-out'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000004'', ''qty'', 1)))',
  'a product with zero stock cannot be ordered', '23514');

select tests.throws(
  'select public.place_order(''t-over-stock'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000006'', ''qty'', 99)))',
  'more than the remaining stock cannot be ordered', '23514');

-- NULL stock means made to order. It must never be treated as sold out.
select tests.lives(
  'select public.place_order(''t-made-to-order'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000003'', ''qty'', 4)))',
  'a made-to-order product with null stock can be ordered in quantity');

select tests.throws(
  'select public.place_order(''t-wrong-variant'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(
       ''product_id'', ''dddd0001-0000-4000-8000-000000000002'',
       ''variant_id'', (select id from public.product_variants where sku = ''THI-CT-WAL''),
       ''qty'', 1)))',
  'a variant belonging to a different product is refused', '23503');

select tests.throws(
  'select public.place_order(''t-zero-qty'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000002'', ''qty'', 0)))',
  'a quantity of zero is refused', '22023');

select tests.throws(
  'select public.place_order(''t-negative-qty'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000002'', ''qty'', -5)))',
  'a negative quantity is refused', '22023');

select tests.throws(
  'select public.place_order(''t-empty'', ''bbbb0001-0000-4000-8000-000000000001'', ''[]''::jsonb)',
  'an empty cart is refused', '22023');

-- Someone else's address. This is an ownership test wearing a checkout costume.
select tests.throws(
  'select public.place_order(''t-other-address'', ''bbbb0001-0000-4000-8000-000000000003'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000002'', ''qty'', 1)))',
  'another customer address cannot be used', '42501');

select tests.throws(
  'select public.place_order(''t-missing-product'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''00000000-0000-4000-8000-000000000000'', ''qty'', 1)))',
  'a product that does not exist is refused', '23503');

-- ===========================================================================
-- Anonymous checkout is not a thing
-- ===========================================================================

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select tests.throws(
  'select public.place_order(''t-anon'', ''bbbb0001-0000-4000-8000-000000000001'',
     jsonb_build_array(jsonb_build_object(''product_id'',
       ''dddd0001-0000-4000-8000-000000000002'', ''qty'', 1)))',
  'anon cannot place an order', '42501');

reset role;
select tests.finish();

rollback;
