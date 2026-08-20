-- Foundation: extensions, enums, and the two helper functions every other
-- migration leans on.
--
-- Every SECURITY DEFINER function in this schema sets an empty search_path and
-- schema-qualifies every identifier. Without that, a caller controlling
-- search_path can point `profiles` at a table they own. See ADR-005.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Lowercase snake_case, matching the DB naming convention in CLAUDE.md. The
-- uppercase names in docs/domain.md are the prose spelling of these values.
create type public.order_status as enum (
  'pending_confirmation',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned'
);

create type public.payment_status as enum (
  'unpaid',
  'paid'
);

create type public.cancellation_reason as enum (
  'customer_changed_mind',
  'customer_unreachable',
  'customer_no_show',
  'out_of_stock',
  'delivery_not_possible',
  'damaged_in_transit',
  'merchant_error'
);

-- ---------------------------------------------------------------------------
-- Helpers
--
-- is_admin() is NOT here. It reads public.profiles, and a `language sql` body is
-- validated when the function is created, so it cannot exist before the table
-- does. It lives in 20260820090100_identity.sql, immediately after profiles.
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest without every writer having to remember.
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
