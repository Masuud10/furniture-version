# CLAUDE.md — project constitution

Furniture commerce for a single merchant. Cash on delivery. No payment gateway.

This file is binding. So is everything in `docs/adr/`. If a task conflicts with
these rules, stop and say so rather than working around them.

---

## The one rule everything else follows from

**The browser may never assert a price, an order total, or an order status.**

The client talks directly to Postgres through `supabase-js`. That is the speed
advantage and it is the security trap. Reads are governed by RLS; writes that
carry money or state are governed by `SECURITY DEFINER` functions.

| Operation | Where it runs |
|---|---|
| Browse published products | Client via `supabase-js` + RLS |
| Read own orders | Client or RSC via RLS |
| **Place an order** | `place_order()` — Postgres, `SECURITY DEFINER` |
| **Change order status** | `advance_order_status()` — Postgres, `SECURITY DEFINER` |
| Publish product / upload media | Next.js Server Action, admin-gated |

An `insert into orders (total_minor) values (clientTotal)` is a build failure,
not a code review nit. The order payload schema does not contain a price field —
there is nothing to tamper with.

---

## Stack

- Next.js 16 App Router, TypeScript strict, React 19
- Supabase: Postgres, Auth, Storage, RLS, Realtime
- Tailwind CSS v4 (CSS-first config, `@theme`)
- Vercel

Exact pinned versions live in `docs/dependencies.md`. Do not bump without an ADR
or an explicit instruction.

---

## Money

- Stored as `bigint` **minor units**. KES cents. `1 KES = 100 cents`.
- Never `float`, never `numeric` for amounts, never a JS `number` in a DB column.
- In TypeScript money crosses the wire as a `string` or `bigint`, never a
  `number`, because `bigint` does not survive `JSON.stringify` and a `number`
  silently loses precision above 2^53.
- All arithmetic goes through `src/lib/money.ts`. No ad-hoc `* 100` anywhere.
- `CURRENCY` is `KES`, set once as an env constant and stored per row so a future
  second currency is a data change, not a migration.
- Formatting is a presentation concern: `Intl.NumberFormat('en-KE', …)` inside
  the `<Price>` primitive, nowhere else.

---

## Directory layout

```
src/
  app/
    (storefront)/          public pages — static, tag-revalidated
    (account)/account/     customer area — dynamic
    admin/                 merchant console — dynamic, admin-gated
    api/                   route handlers (rare; prefer server actions)
  components/
    ui/                    primitives: Button, Input, Field, Price, Media …
    storefront/            product cards, gallery, filters
    admin/                 board, order detail, editors
  lib/
    supabase/              client.ts, server.ts, middleware.ts, admin.ts
    money.ts               minor-unit arithmetic and formatting
    orders/                state machine table, transition helpers
    validation/            Zod schemas shared client and server
    database.types.ts      generated — never hand-edit
  styles/
supabase/
  migrations/              plain SQL, timestamp-prefixed, forward-only
  tests/                   pgTAP hostile-role tests
  seed.sql
docs/
  adr/                     one decision per file
  domain.md security.md design-brief.md dependencies.md progress.md runbook.md
```

## Naming

- Files: `kebab-case.ts`. React components: `PascalCase.tsx`.
- DB: `snake_case`, tables plural, columns singular. Money columns end `_minor`.
  Timestamps end `_at`. Booleans read as assertions: `is_default`, `phone_verified`.
- Enums are Postgres enums, mirrored in `src/lib/orders/` as `const` objects
  derived from the generated types — never re-declared by hand.
- Server-only modules start with `import 'server-only'`.

---

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` appears in server-only modules and nowhere else.
  It is never imported, directly or transitively, from a `'use client'` file.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the
  browser. Both are safe to expose *because RLS is on every table*, which is why
  RLS is not optional on any table, ever, including lookup tables.
- Phase 8 verifies this by grepping the built client bundle, not the source.

---

## Authorization

- RLS is the boundary. Middleware is a convenience that produces nicer redirects.
- Every admin page also does a server-side `is_admin()` check. Two layers,
  because one of them will eventually be edited by someone in a hurry.
- Admin role lives in `profiles.role` and is read through the `is_admin()`
  `SECURITY DEFINER` function. See ADR-005 for why, and for the recursion footgun
  that makes the naive version fail.

---

## Data rules

- **Snapshot everything the customer agreed to.** Price, product name, variant
  name, thumbnail and the full delivery address are copied into the order at
  placement. Raising a price or renaming a product must never rewrite history.
- **Archive, never delete, products.** Orders reference them.
- `order_number` is human-readable — `FRN-2026-0417` — because customers read it
  over the phone. It is not the primary key.
- `order_events` is a product feature, not an audit log. It renders as the
  customer-facing status timeline.

---

## Testing expectations

- **pgTAP** for RLS. The suite authenticates *as* each role and asserts failure.
  A test that passes when it should fail is a broken test, not a green build.
- **Vitest** for pure functions: money arithmetic, the transition table, cart
  merge, delivery fee. No mocks — if a unit test needs a mock, the logic is in
  the wrong place.
- **Playwright** for the two funnels that matter: customer purchase, and admin
  order lifecycle. Plus the negative paths — customer reaching `/admin`, opening
  another user's order by id.
- Done means: `typecheck` passes, `lint` passes, tests pass, and you have written
  down what you verified by hand.

---

## Writing for people

Every user-facing string is written for a person, not a system.

- Active voice, sentence case, one job per label.
- "Place order" produces "Order placed."
- Errors say what happened and what to do next: "That email and password don't
  match" — not "Authentication failed". No error reveals whether an account exists.
- Empty states are invitations.
- Never surface a raw Postgres error. Map error codes to sentences.

---

## Commits

Conventional commits, scoped by phase area:

```
feat(checkout): place order through the idempotent RPC
fix(rls): block customers from reading other customers' order_items
chore(deps): pin supabase-js 2.112.3
docs(adr): ADR-006 delivery zone fee table
```

One logical change per commit. Migrations are never edited after they are
applied anywhere — write a new one.

---

## Before you write code

1. Read this file and `docs/adr/*.md`.
2. Read the existing code in the area you are changing. Match its patterns.
3. Verify every external API against current official documentation. Do not
   invent packages, options or method signatures. If unsure whether an API
   exists in the installed version, read `node_modules` or the docs.
4. State the plan. If the plan shows the task as specified is wrong, say so
   and stop.

Constraints that never relax: TypeScript strict, no `any`, no non-null
assertions used to silence the compiler, money is bigint minor units, no
client-supplied price, no secret in the browser.
