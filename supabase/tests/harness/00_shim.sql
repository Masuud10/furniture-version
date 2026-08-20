-- Supabase shim for a plain PostgreSQL server.
--
-- WHY THIS EXISTS
-- The migrations target Supabase, which supplies auth, storage, the anon /
-- authenticated roles, and an event trigger that exposes new tables to the Data
-- API. None of that exists on a vanilla Postgres. This file recreates the parts
-- the schema actually depends on, so the hostile test suite can run against a
-- local server when Docker is unavailable.
--
-- THIS FILE IS NEVER APPLIED TO A SUPABASE DATABASE. It lives in tests/harness,
-- not in migrations, and `supabase db reset` does not see it.
--
-- The fidelity that matters: auto-generated APIs are ON for the hosted project,
-- which means anon and authenticated receive table privileges at CREATE TABLE
-- time without an explicit GRANT. The event trigger below reproduces that. Get
-- this wrong and every "a customer cannot INSERT an order" test passes for the
-- wrong reason — because no privilege was ever granted — and the suite becomes
-- decorative.

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists shim;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

do $shim$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$shim$;

grant usage on schema public     to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth       to anon, authenticated, service_role;
grant usage on schema storage    to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth
-- ---------------------------------------------------------------------------

create table if not exists auth.users (
  instance_id                 uuid,
  id                          uuid primary key,
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255) unique,
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          varchar(255),
  confirmation_sent_at        timestamptz,
  recovery_token              varchar(255),
  recovery_sent_at            timestamptz,
  email_change_token_new      varchar(255),
  email_change                varchar(255),
  email_change_sent_at        timestamptz,
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb,
  raw_user_meta_data          jsonb,
  is_super_admin              boolean,
  created_at                  timestamptz,
  updated_at                  timestamptz,
  phone                       text unique,
  phone_confirmed_at          timestamptz,
  banned_until                timestamptz,
  deleted_at                  timestamptz
);

create table if not exists auth.identities (
  id              uuid,
  user_id         uuid not null references auth.users (id) on delete cascade,
  provider_id     text not null,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  primary key (provider_id, provider)
);

-- The real implementations read the JWT that PostgREST put into the request
-- settings. These read the same settings, so `set local request.jwt.claims`
-- behaves identically in a test.
create or replace function auth.uid()
  returns uuid
  language sql
  stable
as $shim$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$shim$;

create or replace function auth.role()
  returns text
  language sql
  stable
as $shim$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.role', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    ),
    ''
  )::text;
$shim$;

create or replace function auth.jwt()
  returns jsonb
  language sql
  stable
as $shim$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$shim$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default extensions.gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  metadata         jsonb,
  path_tokens      text[],
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now()
);

alter table storage.objects enable row level security;

grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auto-exposed APIs
--
-- Reproduces the hosted project's behaviour: a table created in `public` is
-- reachable by anon and authenticated without anyone granting anything. This is
-- what makes the REVOKEs in 20260820090400_rls.sql load-bearing, and what makes
-- a test asserting "customer cannot INSERT an order" mean something.
-- ---------------------------------------------------------------------------

create or replace function shim.auto_expose()
  returns event_trigger
  language plpgsql
as $shim$
declare
  r record;
begin
  for r in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE SEQUENCE', 'CREATE VIEW')
  loop
    if r.schema_name = 'public' then
      if r.command_tag = 'CREATE SEQUENCE' then
        execute format('grant usage, select on sequence %s to anon, authenticated', r.object_identity);
      else
        execute format('grant select, insert, update, delete on %s to anon, authenticated', r.object_identity);
      end if;
    end if;
  end loop;
end;
$shim$;

drop event trigger if exists shim_auto_expose;
create event trigger shim_auto_expose
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE SEQUENCE', 'CREATE VIEW')
  execute function shim.auto_expose();
