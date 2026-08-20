# ADR-001 — supabase-js with generated types, not an ORM

**Status:** Accepted · 2026-08-20

## Context

The app needs typed database access from three places: React Server Components,
client components, and server actions. Three candidates: `supabase-js`, Prisma,
Drizzle.

The deciding question is not ergonomics. It is *where authorization lives*. This
project ships a public anon key to every browser. That is only safe if the
database itself refuses to answer questions the caller has no right to ask —
which means Row Level Security has to be the single, unbypassable source of
authorization truth.

## Decision

Use `supabase-js` with types generated from the live schema by
`supabase gen types typescript`, committed to `src/lib/database.types.ts`.

Schema is owned by plain SQL migrations in `supabase/migrations/`, managed by the
Supabase CLI and applied in CI. One source of schema truth; the TypeScript types
are a derived artifact and are never hand-edited.

## Consequences

- Every request carries the caller JWT, so RLS applies automatically. There is no
  code path that "forgets" to filter by user.
- Schema drift becomes a compile error, because the generated types come from the
  schema that actually exists.
- Regenerating types is a required step of any migration. Skipping it breaks the
  build, which is the desired failure mode.
- No query builder. Complex reads become Postgres views or RPCs, which is where
  we want them anyway (see ADR-002).
- A service-role client exists in exactly one server-only module and bypasses RLS
  by design. It is used for admin storage operations and nothing else.

## Rejected alternatives

**Prisma.** Connects as a privileged role over a direct connection and therefore
**bypasses RLS by default**. Making it respect RLS means wrapping every query in
a transaction that sets `request.jwt.claims`, via a client extension. That is a
real, documented pattern — but it duplicates authorization in two places, and the
failure mode of forgetting the wrapper is silent total data exposure. Prisma
guidance for Supabase has moved more than once; re-read it before revisiting
this, but the structural objection is not about tooling maturity. Rejected.

**Drizzle.** A reasonable middle ground with first-class RLS helpers, and the
right pick if the team wanted a query builder. It adds a second source of schema
truth (TS schema files alongside SQL migrations) kept in sync by discipline. Not
worth it for a schema this size. Rejected without prejudice.

**Supabase Studio as schema editor.** Fast and untracked. Schema changes made in
a browser are invisible to code review and impossible to replay. Rejected.
