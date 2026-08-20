-- Identity: profiles and addresses.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text,
  phone           text,
  -- Kept even though phone OTP is out of scope, so reintroducing verification
  -- is a feature and not a migration. See ADR-007.
  phone_verified  boolean not null default false,
  role            text not null default 'customer'
                    check (role in ('customer', 'admin')),
  -- Incremented only by a cancellation with reason 'customer_no_show'.
  -- Surfaced to the merchant as a badge; never an automatic block.
  no_show_count   integer not null default 0 check (no_show_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint profiles_phone_e164
    check (phone is null or phone ~ '^\+[1-9]\d{7,14}$')
);

comment on table public.profiles is 'One row per auth.users row, created by trigger on signup.';
comment on column public.profiles.phone is 'E.164, normalised on write by the application. Not verified — see ADR-007.';

create index profiles_role_idx on public.profiles (role) where role = 'admin';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Reads profiles OUTSIDE the calling policy's RLS context. A policy on profiles
-- that selects from profiles recurses; this is the documented way out.
-- STABLE so the planner calls it once per statement rather than once per row.
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the current request is authenticated as an admin. SECURITY DEFINER so it can read profiles without triggering the policy it is used by.';

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- A profile exists for every user, always. Doing this in the database rather
-- than in a signup handler means it cannot be skipped by a different client.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role escalation guard.
--
-- A policy cannot express "you may update this row but not this column" well
-- enough to rely on: UPDATE ... USING (id = auth.uid()) happily lets a customer
-- write role = 'admin'. This trigger is the actual boundary.
--
-- The auth.uid() IS NULL branch is the migration/seed path — a direct database
-- connection with no JWT. It is not reachable from PostgREST as a customer,
-- because anon has no UPDATE policy on profiles and authenticated always has a
-- uid. service_role bypasses RLS by design and lives server-side only.
create or replace function public.guard_profile_role_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin()
  then
    raise exception 'Only an admin can change a role.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ---------------------------------------------------------------------------
-- delivery_zones
-- ---------------------------------------------------------------------------

-- A flat delivery fee is either a loss or a deterrent in a country where
-- Kilimani and Kisumu are not the same job. See ADR-006.
create table public.delivery_zones (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null unique,
  fee_minor   bigint not null check (fee_minor >= 0),
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index delivery_zones_active_idx on public.delivery_zones (active, position);

create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------

create table public.addresses (
  id               uuid primary key default extensions.gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  label            text,
  recipient_name   text not null,
  phone            text not null,
  line1            text not null,
  line2            text,
  city             text not null,
  region           text,
  landmark         text,
  -- The zone is what place_order prices the delivery from. An address without
  -- one cannot be checked out against, which is enforced in the function.
  delivery_zone_id uuid references public.delivery_zones (id) on delete restrict,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint addresses_phone_e164 check (phone ~ '^\+[1-9]\d{7,14}$'),
  constraint addresses_recipient_name_present check (length(trim(recipient_name)) > 0),
  constraint addresses_line1_present check (length(trim(line1)) > 0)
);

create index addresses_user_idx on public.addresses (user_id, created_at desc);

-- At most one default per customer, enforced by the database rather than by
-- whichever form happened to write last.
create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();
