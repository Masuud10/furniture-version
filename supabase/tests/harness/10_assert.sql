-- A minimal assertion harness.
--
-- pgTAP is the usual choice and `supabase test db` expects it, but pgTAP is not
-- installable on the Postgres available here. These helpers cover what the
-- hostile suite actually needs and depend on nothing outside core Postgres, so
-- the same test files run on a plain server today and under the Supabase CLI
-- later.
--
-- Everything here is SECURITY INVOKER on purpose. A SECURITY DEFINER helper
-- would run its payload as the owner and quietly bypass the RLS the tests
-- exist to check — every test would pass, and none would mean anything.

create schema if not exists tests;
grant usage on schema tests to public;

drop table if exists tests.result;
create table tests.result (
  id       serial primary key,
  name     text not null,
  passed   boolean not null,
  detail   text
);
grant insert, select on tests.result to public;
grant usage, select on sequence tests.result_id_seq to public;

-- ---------------------------------------------------------------------------
-- Recording
-- ---------------------------------------------------------------------------

create or replace function tests.record(p_name text, p_passed boolean, p_detail text default null)
  returns void
  language sql
as $t$
  insert into tests.result (name, passed, detail) values (p_name, p_passed, p_detail);
$t$;

create or replace function tests.ok(p_condition boolean, p_name text)
  returns void
  language sql
as $t$
  select tests.record(p_name, coalesce(p_condition, false),
    case when coalesce(p_condition, false) then null else 'expected true' end);
$t$;

-- ---------------------------------------------------------------------------
-- Expectations about failure — the important half of this suite
-- ---------------------------------------------------------------------------

-- Asserts the statement raises. Optionally that it raises a specific SQLSTATE:
-- 42501 for a privilege or policy refusal, 23514 for a rule the schema
-- enforces. Passing the code stops a test from passing because of an unrelated
-- typo in the SQL it was supposed to be testing.
create or replace function tests.throws(p_sql text, p_name text, p_errcode text default null)
  returns void
  language plpgsql
as $t$
declare
  v_state text;
  v_msg   text;
begin
  execute p_sql;
  perform tests.record(p_name, false, 'expected an error, the statement succeeded');
exception
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    if p_errcode is null or v_state = p_errcode then
      perform tests.record(p_name, true, v_state || ': ' || v_msg);
    else
      perform tests.record(p_name, false,
        format('expected SQLSTATE %s, got %s: %s', p_errcode, v_state, v_msg));
    end if;
end;
$t$;

create or replace function tests.lives(p_sql text, p_name text)
  returns void
  language plpgsql
as $t$
declare
  v_state text;
  v_msg   text;
begin
  execute p_sql;
  perform tests.record(p_name, true);
exception
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform tests.record(p_name, false, format('unexpected %s: %s', v_state, v_msg));
end;
$t$;

-- ---------------------------------------------------------------------------
-- Expectations about visibility
--
-- RLS does not raise on SELECT. It returns fewer rows. A test that only checks
-- for an exception will never catch a leak, which is why these exist.
-- ---------------------------------------------------------------------------

create or replace function tests.rowcount(p_sql text, p_expected bigint, p_name text)
  returns void
  language plpgsql
as $t$
declare
  v_count bigint;
  v_state text;
  v_msg   text;
begin
  execute format('select count(*) from (%s) _q', p_sql) into v_count;
  if v_count = p_expected then
    perform tests.record(p_name, true);
  else
    perform tests.record(p_name, false,
      format('expected %s row(s), got %s', p_expected, v_count));
  end if;
exception
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform tests.record(p_name, false, format('query failed with %s: %s', v_state, v_msg));
end;
$t$;

create or replace function tests.sees_nothing(p_sql text, p_name text)
  returns void
  language sql
as $t$
  select tests.rowcount(p_sql, 0::bigint, p_name);
$t$;

-- "Must not see this" is satisfied two different ways depending on how the
-- boundary is built: a revoked privilege raises 42501, while a policy that
-- simply matches no rows returns an empty set. Both are a pass. Asserting only
-- one of them makes the test brittle against a correct implementation.
create or replace function tests.blocked(p_sql text, p_name text)
  returns void
  language plpgsql
as $t$
declare
  v_count bigint;
  v_state text;
  v_msg   text;
begin
  execute format('select count(*) from (%s) _q', p_sql) into v_count;
  if v_count = 0 then
    perform tests.record(p_name, true, 'no rows visible');
  else
    perform tests.record(p_name, false, format('LEAK: %s row(s) visible', v_count));
  end if;
exception
  when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    perform tests.record(p_name, true, '42501: ' || v_msg);
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform tests.record(p_name, false, format('unexpected %s: %s', v_state, v_msg));
end;
$t$;

-- The write-side counterpart to tests.blocked.
--
-- A refused write shows up two different ways. A revoked privilege raises
-- 42501. A row-level policy that matches nothing simply updates zero rows and
-- reports success — no error is raised, and nothing changed. Asserting only on
-- the exception marks the second case as a failure even though the data is
-- safe, which is how a correct schema gets "fixed" into a broken one.
create or replace function tests.writes_nothing(p_sql text, p_name text)
  returns void
  language plpgsql
as $t$
declare
  v_rows  bigint;
  v_state text;
  v_msg   text;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    perform tests.record(p_name, true, 'no rows affected');
  else
    perform tests.record(p_name, false, format('LEAK: %s row(s) written', v_rows));
  end if;
exception
  when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    perform tests.record(p_name, true, '42501: ' || v_msg);
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform tests.record(p_name, true, format('refused with %s: %s', v_state, v_msg));
end;
$t$;

create or replace function tests.eq(p_sql text, p_expected text, p_name text)
  returns void
  language plpgsql
as $t$
declare
  v_actual text;
  v_state  text;
  v_msg    text;
begin
  execute p_sql into v_actual;
  if v_actual is not distinct from p_expected then
    perform tests.record(p_name, true);
  else
    perform tests.record(p_name, false,
      format('expected %L, got %L', p_expected, v_actual));
  end if;
exception
  when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform tests.record(p_name, false, format('query failed with %s: %s', v_state, v_msg));
end;
$t$;

-- ---------------------------------------------------------------------------
-- Finish
-- ---------------------------------------------------------------------------

-- Raises when anything failed, so psql with ON_ERROR_STOP=1 exits non-zero and
-- the suite cannot be green by being ignored.
create or replace function tests.finish()
  returns text
  language plpgsql
as $t$
declare
  v_total  bigint;
  v_failed bigint;
  v_lines  text;
begin
  select count(*), count(*) filter (where not passed) into v_total, v_failed
  from tests.result;

  if v_failed > 0 then
    select string_agg(format('  FAIL  %s%s', name,
             case when detail is null then '' else E'\n        ' || detail end),
             E'\n' order by id)
    into v_lines
    from tests.result where not passed;

    raise exception E'% of % assertions failed\n%', v_failed, v_total, v_lines;
  end if;

  return format('ok  %s assertions passed', v_total);
end;
$t$;

grant execute on all functions in schema tests to public;
