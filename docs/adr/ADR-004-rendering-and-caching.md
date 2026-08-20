# ADR-004 — Static product pages with tag-based revalidation

**Status:** Accepted · 2026-08-20

## Context

The storefront is read-heavy, rarely changed, and its job is to rank in search
and load fast on a mid-range Android phone. The admin console and the account
area are the opposite: per-user, always fresh, never cached.

Rendering these two the same way makes one of them wrong.

## Decision

Split by route group, and make the cache invalidation explicit rather than
time-based.

**Static, cached, tag-revalidated** — home, category listings, product detail,
search shell, about, contact. `generateStaticParams` over published product slugs.
Data reads are tagged:

    product:<slug>     one product page
    products           every listing that contains products
    category:<slug>    one category listing

Publishing, unpublishing, archiving or editing a product calls `revalidateTag`
for that product and for `products`. A time-based `revalidate` is set as a long
backstop only, so a missed tag is stale for hours rather than forever.

**Dynamic, uncached** — cart, `/account/*`, `/admin/*`. These read cookies, so
they opt out of static rendering by construction; the opt-out is also declared
explicitly rather than left as an inference.

Sessions use `@supabase/ssr` with `createServerClient` / `createBrowserClient`
plus middleware refresh.

## Consequences

- Product pages are served from the edge with no database round trip. LCP is an
  image, not a query.
- Publish-to-visible is seconds, and it is deterministic — the merchant is not
  told to "wait for the cache".
- The invalidation contract is a real contract. A future write path that changes
  product data and forgets `revalidateTag` produces a stale page. Every admin
  mutation therefore goes through one `publishProduct` / `mutateProduct` helper
  that owns the tagging, rather than each form calling `revalidateTag` itself.
- Price shown on a static page can lag the database by the length of that window.
  This is why checkout re-validates prices and requires explicit re-confirmation
  when they moved, and why `place_order` re-reads prices regardless.
- Caching semantics in the App Router have changed across major versions. Verify
  the current `revalidateTag` and `use cache` behaviour against the docs for the
  pinned Next version before building on it.

## Rejected alternatives

**Everything dynamic.** Simple and always correct, but every product view is a
database round trip and TTFB is at the mercy of the Supabase region. For a
catalogue that changes a few times a week, that is paying constantly for
freshness that is needed rarely. Rejected.

**Time-based ISR only.** No publish hook needed, but the merchant publishes a
product and then watches an old page. Rejected as the primary mechanism, kept as
a backstop.

**Client-side fetching of the catalogue.** Kills SEO on the pages whose entire
purpose is SEO. Rejected.
