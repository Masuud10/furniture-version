# ADR-005 — Admin role via is_admin(), not a JWT claim

**Status:** Accepted · 2026-08-20

## Context

Roughly half the RLS policies in this schema need to answer one question: is the
caller an admin? The role itself lives in `profiles.role`.

The naive implementation does not work, and fails in a way that is worth writing
down because it will be reinvented:

    -- BROKEN. Do not ship this.
    create policy "admins read all profiles" on profiles for select
      using (
        exists (select 1 from profiles p
                where p.id = auth.uid() and p.role = 'admin')
      );

Evaluating this policy requires selecting from `profiles`, which requires
evaluating the policy on `profiles`, which requires selecting from `profiles`.
Postgres returns `infinite recursion detected in policy for relation "profiles"`.
The same trap catches any policy that reads the table it is protecting.

## Decision

A `SECURITY DEFINER` function that reads `profiles` outside the calling policy's
RLS context:

    create function public.is_admin() returns boolean
      language sql
      stable
      security definer
      set search_path = ''
    as $fn$
      select exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and role = 'admin'
      );
    $fn$;

Every policy that needs the answer calls `public.is_admin()`. The empty
`search_path` is not optional: without it, a caller controlling `search_path`
could point `public.profiles` at a table they own.

Role escalation is blocked separately, by a `BEFORE UPDATE` trigger on `profiles`
that rejects any change to `role` unless the actor is already an admin. A policy
alone is not enough, because `UPDATE ... USING (id = auth.uid())` happily permits
a customer to rewrite their own `role` column.

Both are tested as a hostile user. See `docs/security.md`.

## Consequences

- One extra index lookup per policy evaluation. `profiles` is small and the
  lookup is on the primary key; the function is `stable`, so Postgres can call it
  once per statement rather than once per row.
- Revoking an admin takes effect on the next query. No token lifetime window.
- `is_admin()` is a piece of security-critical code in one place, which is where
  it can be reviewed and tested.
- Every future `SECURITY DEFINER` function in this schema inherits the same two
  requirements: empty `search_path`, and an explicit authorization check in the
  body.

## Rejected alternatives

**Custom Access Token Hook injecting `user_role` into the JWT.** Zero query cost
per check, and genuinely the better answer at scale. Rejected for two reasons.
First, the claim is stale until the token refreshes, so a revoked admin keeps
admin access for up to the token lifetime — unacceptable for the role that can
read every customer address and phone number. Second, availability of the hook
depends on the Supabase plan, and this build should not have a plan dependency
for something this fundamental. Revisit only if policy evaluation actually shows
up in query plans.

**A separate `admin_users` table with RLS disabled.** Avoids recursion by
avoiding the protected table. It also creates a table with no RLS in a codebase
whose stated rule is that every table has RLS, and that exception is exactly the
kind of thing that gets copied. Rejected.

**Checking the role only in Next.js middleware.** Middleware is a redirect
convenience, not a boundary. Anyone with the anon key can query Supabase directly
and never touch middleware. Rejected as a mechanism; retained as UX.
