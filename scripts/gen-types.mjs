/**
 * Generate src/lib/database.types.ts by introspecting a Postgres schema.
 *
 * WHY THIS EXISTS
 * `supabase gen types typescript` shells out to a Docker container even when
 * given --db-url, and Docker is unavailable on this machine. This produces the
 * same shape from pg_catalog directly, so the types stay a derived artifact
 * rather than something anyone edits by hand.
 *
 * When Docker comes back, `npm run db:types` is the canonical path again. Run
 * both and diff before deleting this.
 *
 * Usage:  node scripts/gen-types.mjs            (reads .env.local)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

const env = { ...process.env };
const envFile = join(ROOT, '.env.local');
if (existsSync(envFile)) {
  for (const rawLine of readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq);
    if (!env[key]) env[key] = line.slice(eq + 1);
  }
}

const PSQL =
  env.PSQL_BIN ??
  ['C:/Program Files/PostgreSQL/18/bin/psql.exe', 'C:/Program Files/PostgreSQL/17/bin/psql.exe'].find(
    (p) => existsSync(p),
  ) ??
  'psql';

const DB = env.PGDATABASE_TEST ?? 'furniture_local';

function query(sql) {
  const out = execFileSync(
    PSQL,
    ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
     '-h', env.PGHOST ?? '127.0.0.1',
     '-p', env.PGPORT ?? '5432',
     '-U', env.PGUSER ?? 'postgres',
     '-d', DB, '-c', sql],
    { env: { ...env, PGPASSWORD: env.PGPASSWORD ?? '' }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(out.trim() || 'null');
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

const enums = query(`
  select coalesce(json_agg(e order by e->>'name'), '[]'::json) from (
    select json_build_object(
      'name', t.typname,
      'values', (select json_agg(l.enumlabel order by l.enumsortorder)
                 from pg_enum l where l.enumtypid = t.oid)
    ) as e
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ) s`);

const tables = query(`
  select coalesce(json_agg(t order by t->>'name'), '[]'::json) from (
    select json_build_object(
      'name', c.relname,
      'kind', case c.relkind when 'v' then 'view' when 'm' then 'view' else 'table' end,
      'columns', (
        select json_agg(json_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'udt',  bt.typname,
          'notNull', a.attnotnull,
          'hasDefault', (a.atthasdef and not a.attgenerated <> ''),
          'generated', a.attgenerated <> '' or a.attidentity <> ''
        ) order by a.attnum)
        from pg_attribute a
        join pg_type bt on bt.oid = a.atttypid
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'foreignKeys', (
        select coalesce(json_agg(json_build_object(
          'name', con.conname,
          'columns', (select json_agg(att.attname order by u.ord)
                      from unnest(con.conkey) with ordinality u(attnum, ord)
                      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum),
          'foreignTable', fc.relname,
          'foreignColumns', (select json_agg(att.attname order by u.ord)
                      from unnest(con.confkey) with ordinality u(attnum, ord)
                      join pg_attribute att on att.attrelid = con.confrelid and att.attnum = u.attnum)
        ) order by con.conname), '[]'::json)
        from pg_constraint con
        join pg_class fc on fc.oid = con.confrelid
        where con.conrelid = c.oid and con.contype = 'f'
      )
    ) as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  ) s`);

const functions = query(`
  select coalesce(json_agg(f order by f->>'name'), '[]'::json) from (
    select json_build_object(
      'name', p.proname,
      'args', (
        select coalesce(json_agg(json_build_object(
                 'name', coalesce(p.proargnames[i], 'arg' || i),
                 'type', format_type(p.proargtypes[i - 1], null),
                 'hasDefault', i > (p.pronargs - p.pronargdefaults)
               ) order by i), '[]'::json)
        from generate_series(1, p.pronargs) as i
      ),
      'returns', format_type(p.prorettype, null),
      'returnsSet', p.proretset
    ) as f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- Trigger functions and event triggers are not callable over the API.
      and format_type(p.prorettype, null) not in ('trigger', 'event_trigger')
      -- Anything the client cannot execute has no business in the client types.
      and has_function_privilege('authenticated', p.oid, 'execute')
  ) s`);

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

const enumNames = new Set(enums.map((e) => e.name));
const tableNames = new Set(tables.map((t) => t.name));

const SCALARS = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  // PostgREST serialises int8 as a JSON number. Money is validated at the
  // boundary in src/lib/money.ts rather than trusted here.
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  uuid: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  json: 'Json',
  jsonb: 'Json',
  bytea: 'string',
  tsvector: 'unknown',
};

function tsType(udt) {
  if (udt.startsWith('_')) return `${tsType(udt.slice(1))}[]`;
  if (enumNames.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  if (tableNames.has(udt)) return `Database["public"]["Tables"]["${udt}"]["Row"]`;
  return SCALARS[udt] ?? 'unknown';
}

function tsTypeFromFormatted(formatted) {
  const isArray = formatted.endsWith('[]');
  const base = (isArray ? formatted.slice(0, -2) : formatted)
    .replace(/^public\./, '')
    .replace(/\(.*\)$/, '')
    .trim();
  const alias = {
    'character varying': 'varchar',
    character: 'bpchar',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'double precision': 'float8',
    integer: 'int4',
    smallint: 'int2',
    bigint: 'int8',
    boolean: 'bool',
    void: 'void',
  }[base] ?? base;
  if (alias === 'void') return 'undefined';
  const mapped = tsType(alias);
  return isArray ? `${mapped}[]` : mapped;
}

const q = (name) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name));

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const out = [];
out.push('// GENERATED FILE — do not edit by hand.');
out.push('//');
out.push('// Produced by `npm run db:types:local` (scripts/gen-types.mjs), which');
out.push('// introspects the schema built from supabase/migrations. The canonical');
out.push('// generator is `supabase gen types typescript`; it needs Docker, which is not');
out.push('// available here. Regenerate after every migration — a stale file is a');
out.push('// compile error waiting to happen, which is the point.');
out.push('');
out.push('export type Json =');
out.push('  | string');
out.push('  | number');
out.push('  | boolean');
out.push('  | null');
out.push('  | { [key: string]: Json | undefined }');
out.push('  | Json[];');
out.push('');
out.push('export type Database = {');
out.push('  public: {');

// Tables
out.push('    Tables: {');
for (const table of tables.filter((t) => t.kind === 'table')) {
  out.push(`      ${q(table.name)}: {`);
  out.push('        Row: {');
  for (const c of table.columns) {
    out.push(`          ${q(c.name)}: ${tsType(c.udt)}${c.notNull ? '' : ' | null'};`);
  }
  out.push('        };');

  out.push('        Insert: {');
  for (const c of table.columns) {
    if (c.generated) continue;
    const optional = c.hasDefault || !c.notNull;
    out.push(
      `          ${q(c.name)}${optional ? '?' : ''}: ${tsType(c.udt)}${c.notNull ? '' : ' | null'};`,
    );
  }
  out.push('        };');

  out.push('        Update: {');
  for (const c of table.columns) {
    if (c.generated) continue;
    out.push(`          ${q(c.name)}?: ${tsType(c.udt)}${c.notNull ? '' : ' | null'};`);
  }
  out.push('        };');

  if (table.foreignKeys.length === 0) {
    out.push('        Relationships: [];');
  } else {
  out.push('        Relationships: [');
  for (const fk of table.foreignKeys) {
    out.push('          {');
    out.push(`            foreignKeyName: ${JSON.stringify(fk.name)};`);
    out.push(`            columns: ${JSON.stringify(fk.columns)};`);
    out.push('            isOneToOne: false;');
    out.push(`            referencedRelation: ${JSON.stringify(fk.foreignTable)};`);
    out.push(`            referencedColumns: ${JSON.stringify(fk.foreignColumns)};`);
    out.push('          },');
  }
  out.push('        ];');
  }
  out.push('      };');
}
out.push('    };');

// Views
const views = tables.filter((t) => t.kind === 'view');
if (views.length === 0) {
  // A bare `{}` means "any non-nullish value", not "nothing". Say nothing.
  out.push('    Views: Record<PropertyKey, never>;');
} else {
out.push('    Views: {');
for (const view of views) {
  out.push(`      ${q(view.name)}: {`);
  out.push('        Row: {');
  for (const c of view.columns) {
    out.push(`          ${q(c.name)}: ${tsType(c.udt)}${c.notNull ? '' : ' | null'};`);
  }
  out.push('        };');
  out.push('        Relationships: [];');
  out.push('      };');
}
out.push('    };');
}

// Functions
out.push('    Functions: {');
for (const fn of functions) {
  out.push(`      ${q(fn.name)}: {`);
  if (fn.args.length === 0) {
    out.push('        Args: Record<PropertyKey, never>;');
  } else {
    out.push('        Args: {');
    for (const a of fn.args) {
      out.push(`          ${q(a.name)}${a.hasDefault ? '?' : ''}: ${tsTypeFromFormatted(a.type)};`);
    }
    out.push('        };');
  }
  const returns = tsTypeFromFormatted(fn.returns);
  out.push(`        Returns: ${fn.returnsSet ? `${returns}[]` : returns};`);
  out.push('      };');
}
out.push('    };');

// Enums
out.push('    Enums: {');
for (const e of enums) {
  out.push(`      ${q(e.name)}: ${e.values.map((v) => JSON.stringify(v)).join(' | ')};`);
}
out.push('    };');

out.push('    CompositeTypes: Record<PropertyKey, never>;');
out.push('  };');
out.push('};');
out.push('');

// Convenience aliases. These are the shapes application code actually reaches
// for, and naming them here keeps `Database["public"]["Tables"][...]` out of
// every component signature.
out.push('type PublicSchema = Database["public"];');
out.push('');
out.push('export type Tables<T extends keyof PublicSchema["Tables"]> =');
out.push('  PublicSchema["Tables"][T]["Row"];');
out.push('export type TablesInsert<T extends keyof PublicSchema["Tables"]> =');
out.push('  PublicSchema["Tables"][T]["Insert"];');
out.push('export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =');
out.push('  PublicSchema["Tables"][T]["Update"];');
out.push('export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];');
out.push('export type FunctionArgs<T extends keyof PublicSchema["Functions"]> =');
out.push('  PublicSchema["Functions"][T]["Args"];');
out.push('export type FunctionReturns<T extends keyof PublicSchema["Functions"]> =');
out.push('  PublicSchema["Functions"][T]["Returns"];');
out.push('');

const target = join(ROOT, 'src', 'lib', 'database.types.ts');
writeFileSync(target, out.join('\n'), 'utf8');
console.log(
  `wrote ${target} — ${tables.filter((t) => t.kind === 'table').length} tables, ` +
    `${functions.length} functions, ${enums.length} enums`,
);
