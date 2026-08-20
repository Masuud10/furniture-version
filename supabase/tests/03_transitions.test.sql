-- advance_order_status and mark_order_paid: the state machine.
--
-- The seed creates one order per status, keyed 'seed-<status>'.

begin;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ===========================================================================
-- Illegal transitions
-- ===========================================================================

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-pending_confirmation''),
     ''delivered'')',
  'an order cannot jump from pending_confirmation to delivered', '23514');

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-pending_confirmation''),
     ''in_production'')',
  'an order cannot skip the confirmation call', '23514');

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-cancelled''),
     ''confirmed'')',
  'a cancelled order cannot be revived', '23514');

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-returned''),
     ''delivered'')',
  'a returned order is terminal', '23514');

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-confirmed''),
     ''confirmed'')',
  'an order cannot transition to the status it already has', '23514');

select tests.throws(
  'select public.advance_order_status(
     ''00000000-0000-4000-8000-000000000000''::uuid, ''confirmed'')',
  'an order that does not exist cannot be advanced', '23503');

-- ===========================================================================
-- Cancellation needs a reason, because the reasons are counted
-- ===========================================================================

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-pending_confirmation''),
     ''cancelled'', ''changed their mind'')',
  'cancelling without a reason code is refused', '23514');

select tests.eq(
  'select no_show_count::text from public.profiles
    where id = ''22222222-2222-2222-2222-222222222222''',
  '0', 'customer A starts with no no-shows');

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-pending_confirmation''),
     ''cancelled'', ''Driver waited 20 minutes.'', ''customer_no_show'')',
  'cancelling with a reason is allowed');

select tests.eq(
  'select no_show_count::text from public.profiles
    where id = ''22222222-2222-2222-2222-222222222222''',
  '1', 'a customer_no_show cancellation increments the no-show count');

select tests.eq(
  'select cancellation_reason::text from public.orders
    where idempotency_key = ''seed-pending_confirmation''',
  'customer_no_show', 'the reason code is stored on the order');

-- A reason that is not a no-show must not touch the counter.
select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-ready_for_delivery''),
     ''cancelled'', ''We could not source the timber.'', ''out_of_stock'')',
  'cancelling for a merchant reason is allowed');

select tests.eq(
  'select no_show_count::text from public.profiles
    where id = ''22222222-2222-2222-2222-222222222222''',
  '1', 'a merchant-side cancellation does not blame the customer');

-- ===========================================================================
-- Every accepted transition writes exactly one event
-- ===========================================================================

select tests.eq(
  'select count(*)::text from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.idempotency_key = ''seed-out_for_delivery''',
  '5', 'the seeded out-for-delivery order has its five prior events');

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-out_for_delivery''),
     ''delivered'', ''Handed over at the gate.'')',
  'out_for_delivery can go to delivered');

select tests.eq(
  'select count(*)::text from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.idempotency_key = ''seed-out_for_delivery''',
  '6', 'advancing wrote exactly one new event');

select tests.eq(
  'select from_status::text from public.order_events e
     join public.orders o on o.id = e.order_id
    where o.idempotency_key = ''seed-out_for_delivery''
    order by e.created_at desc limit 1',
  'out_for_delivery', 'the new event records where the order came from');

-- A failed delivery attempt goes back to the queue rather than forcing a
-- cancellation. This transition exists on purpose.
select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-in_production''),
     ''ready_for_delivery'')',
  'in_production can go to ready_for_delivery');

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-in_production''),
     ''out_for_delivery'')',
  'ready_for_delivery can go out for delivery');

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-in_production''),
     ''ready_for_delivery'', ''Nobody home, bringing it back.'')',
  'a failed delivery attempt returns the order to the queue');

-- ===========================================================================
-- Cash is collected on delivery, and not before
-- ===========================================================================

select tests.throws(
  'select public.mark_order_paid(
     (select id from public.orders where idempotency_key = ''seed-in_production''))',
  'an order that has not been delivered cannot be marked paid', '23514');

select tests.throws(
  'select public.mark_order_paid(
     (select id from public.orders where idempotency_key = ''seed-confirmed''))',
  'a confirmed order cannot be marked paid', '23514');

select tests.lives(
  'select public.mark_order_paid(
     (select id from public.orders where idempotency_key = ''seed-out_for_delivery''))',
  'a delivered order can be marked paid');

select tests.eq(
  'select payment_status::text from public.orders
    where idempotency_key = ''seed-out_for_delivery''',
  'paid', 'marking paid closes the loop');

-- The database refuses the impossible state even if the function is bypassed.
reset role;
select tests.throws(
  'update public.orders set payment_status = ''paid''
    where idempotency_key = ''seed-confirmed''',
  'the schema itself refuses paid-before-delivered', '23514');

-- ===========================================================================
-- The value ceiling
--
-- Above the threshold an order cannot enter production until someone has
-- recorded what the customer said on the phone. "Confirmed" with no note is
-- not evidence a call happened.
-- ===========================================================================

reset role;
-- seed-confirmed is the Rift dining table, 12,100,000 — well over the
-- 5,000,000 ceiling. Strip the note from its confirmation event.
update public.order_events
set note = null
where to_status = 'confirmed'
  and order_id = (select id from public.orders where idempotency_key = 'seed-confirmed');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select tests.ok(
  (select total_minor from public.orders where idempotency_key = 'seed-confirmed')
    > (select order_confirmation_threshold_minor from public.shop_settings),
  'the fixture order really is above the confirmation ceiling');

select tests.throws(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-confirmed''),
     ''in_production'')',
  'a high-value order cannot start production without a recorded call', '23514');

reset role;
update public.order_events
set note = 'Spoke to Joy. She confirmed the smoked oak and the delivery date.'
where to_status = 'confirmed'
  and order_id = (select id from public.orders where idempotency_key = 'seed-confirmed');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-confirmed''),
     ''in_production'')',
  'once the call is recorded, production can start');

-- Below the ceiling, no call note is required — the rule is a value threshold,
-- not a blanket obstruction.
reset role;
update public.orders set subtotal_minor = 100000, total_minor = 250000
where idempotency_key = 'seed-delivered';
update public.orders set status = 'confirmed', payment_status = 'unpaid'
where idempotency_key = 'seed-delivered';
delete from public.order_events
where order_id = (select id from public.orders where idempotency_key = 'seed-delivered')
  and to_status <> 'pending_confirmation';
insert into public.order_events (order_id, from_status, to_status, note)
select id, 'pending_confirmation', 'confirmed', null
from public.orders where idempotency_key = 'seed-delivered';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select tests.lives(
  'select public.advance_order_status(
     (select id from public.orders where idempotency_key = ''seed-delivered''),
     ''in_production'')',
  'a low-value order starts production without a recorded call');

reset role;
select tests.finish();

rollback;
