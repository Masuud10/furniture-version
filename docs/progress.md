# Progress — storefront phase

Handoff for the public storefront: home, collections, product detail, search,
showroom, contact, 404, error, JSON-LD, sitemap, robots, OG images.

Cart, checkout, account and admin are **not** built. They are separate phases.

---

## 1. What exists

```
src/
  app/
    layout.tsx                      metadataBase, fonts, Organization JSON-LD, skip link
    robots.ts  sitemap.ts           MetadataRoute
    not-found.tsx  error.tsx
    (storefront)/
      layout.tsx                    header + footer shell
      page.tsx                      home
      opengraph-image.tsx           default OG card
      gallery/page.tsx              photo gallery, paginated
      collections/page.tsx          all categories
      collections/[slug]/page.tsx   listing, filters, pagination
      collections/[slug]/opengraph-image.tsx
      products/[slug]/page.tsx      product detail
      products/[slug]/opengraph-image.tsx
      search/page.tsx               noindex
      showroom/page.tsx             FurnitureStore surface
      contact/page.tsx
      styleguide/page.tsx           token + component reference (noindex)
  components/
    ui/         button, media, product-video, price, prose, spec-list, breadcrumbs
    storefront/ site-header, site-footer, mobile-nav, product-card, product-grid,
                filter-rail, pagination, dimension-figure, product-gallery,
                variant-context, variant-selector, add-to-cart
  lib/
    catalog/    types (read contract), queries (Supabase), fixtures, source (cached),
                client, media-url, dimensions, listing-params, revalidate
    seo/        schema, json-ld, urls, facets, og
    fonts.ts  site.ts  utils/cn.ts
  styles/globals.css                every design token
scripts/        gen-plates.mjs, ingest-media.mjs, subset-fonts.py, og-fonts.py
tests/unit/     40+ assertions on pure functions
tests/e2e/      a11y (axe), storefront (SEO + no-JS), responsive, screenshots
```

---

## 2. Design direction

**Direction B, "Spec sheet"** — as decided in `docs/design-brief.md`. Not re-opened.

- Light is the default because a spec sheet is paper; dark is a true inversion.
- Accent is drafting blue and appears in exactly three places: focus rings, price
  emphasis, active state.
- Rules replace shadows. Shadows are reserved for genuinely floating surfaces.
- Radii are 2px/4px. Nothing is a pill.
- **Signature element:** dimension annotations drawn over the product photograph —
  hairline extension lines, an arrowed dimension line, the measurement on an
  opaque mono plate. Geometry comes from `products.dimensions` crossed with a
  measured anchor box stored per image, so it is a drawing, not a decoration.
  Hover, keyboard focus (`:focus-within`) and a dedicated touch control all
  trigger it; below 480px it withdraws and a dimension strip carries the numbers.

### Typefaces

Inter (body, 400–500) and Inter Tight (display, 600–700) are one superfamily —
shared metrics, one voice, with the tighter fit at display sizes that a spec sheet
wants. JetBrains Mono is the second face and exists to carry every number a person
could measure or read aloud, which is the rule that makes the idea legible.

Self-hosted via `next/font/local`, subsetted by `scripts/subset-fonts.py` from
123 KB to 71 KB across all three (they are all preloaded, so they sit in front of
first paint). `adjustFontFallback: 'Arial'` supplies the metric-matched fallback.

### Contrast, computed not eyeballed

| Pair | Light | Dark |
|---|---|---|
| `--ink` on `--surface` | 16.4:1 | 18.5:1 |
| `--ink-muted` on `--surface` | 6.12:1 | 7.26:1 |
| `--accent` on `--surface` | 6.40:1 | 8.55:1 |
| `--rule-strong` on `--surface` | 3.41:1 | 3.26:1 |

The brief's starting `--accent` (`#1f4fd8`) is only **2.89:1** on the dark ground,
so dark mode uses `#8faaff`. `--rule-strong` was darkened from the brief's
`#9aa0a6` to `#83898f` to clear 3:1 as a UI boundary.

**Removed one decoration I liked** (design brief §9): the faint 12-column rules
behind listings. The dimension annotations are the one bold idea, and a second
visible grid competed with them for the same "technical drawing" register. The
`.column-rules` utility is still in `globals.css`, unused.

---

## 3. Verified APIs (checked against `node_modules`, not memory)

| Thing | Finding |
|---|---|
| Caching primitive | `cacheComponents: true` (top-level in Next 16; `experimental.useCache`/`dynamicIO`/`ppr` are deprecated aliases). `'use cache'` + `cacheTag` + `cacheLife` from `next/cache` — **un-prefixed** in 16.3.1. `unstable_cache` still exists but is the older primitive. |
| `revalidateTag` | Takes **two** arguments in Next 16: `(tag, profile)`. The one-argument form no longer compiles. `updateTag(tag)` is the Server-Action primitive with read-your-own-writes. |
| `dynamicParams` | **Rejected** as a route segment config under `cacheComponents` — on-demand rendering of unknown params is the default, so the ADR-004 requirement still holds. |
| `searchParams` outside `<Suspense>` | Blocked at prerender. `export const instant = false` opts a route into blocking SSR. |
| `PageProps<'/route'>` | Generated from the *previous* build's manifest, so it cannot typecheck on a clean checkout. Explicit `{ params: Promise<{slug:string}> }` used instead. |
| OpenGraph `type` | `'product'` is **not** in Next's union. `'website'` used; product semantics carried by JSON-LD. |
| `@supabase/ssr` 0.12.4 | `setAll` takes a **second `headers` argument**. Not used by the storefront — see §5. |
| `textSearch` | `(column, query, { config, type: 'plain'\|'phrase'\|'websearch' })`. |
| Satori (`next/og`) | Rejects WOFF2 and needs one concrete weight → static TTFs instanced by `scripts/og-fonts.py`. A `<div>` with more than one child needs explicit `display`. `position:absolute; inset:0` resolves against the **padding** box. |

---

## 4. Rendering and caching

| Route | Strategy |
|---|---|
| `/`, `/collections`, `/showroom`, `/contact`, `/styleguide` | Static |
| `/products/[slug]` | Static via `generateStaticParams`; unknown slugs render on demand |
| `/collections/[slug]` | **Blocking SSR** (`instant = false`) |
| `/search` | Blocking SSR, noindex |

`/collections/[slug]` is blocking rather than streamed on purpose. A Suspense
payload arrives as hidden markup that JavaScript swaps in, so a listing built that
way is blank with JS disabled — and no-JS browsing is an acceptance criterion. The
data underneath is still `'use cache'` and tagged, so it is a cache read, not a
database round trip.

Tags (ADR-004): `products`, `product:<slug>`, `category:<slug>`. Invalidated only
through `src/lib/catalog/revalidate.ts`. `cacheLife` supplies the time backstop.

---

## 5. Data access

The storefront reads through `src/lib/catalog/client.ts` — a cookie-free anon
client — **not** the `@supabase/ssr` client. The moment a page calls `cookies()` it
opts out of static rendering and every product page becomes a database round trip.
Published rows are anon-readable under RLS, so no session is needed. The
cookie-bound client stays correct for `/account/*` and `/admin/*`.

`docs/storefront-read-contract.md` is the interface: every table, column and jsonb
shape the storefront expects. **It is the handoff to whoever owns the schema.**

Until the schema exists, `source.ts` falls back to `fixtures.ts` whenever
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset.
`catalogueSourceName()` reports which is live. **The queries in `queries.ts` have
never run against a live database** — they are written to the contract and are the
single most likely place to need correction when the schema lands.

---

## 6. Catalogue content

**Real merchant pieces** — 18 published. Supplied by the merchant, ingested by
`scripts/ingest-media.mjs`; sources kept in `media-source/`.

| Piece | From | Notes |
|---|---|---|
| Seven-seater sofa set, channel back | KSh 170,000 | 3+2+1+1. 45D memory foam, 2yr warranty. **Video** (27.2s -> 19.3s, stream copy). |
| Corduroy sofa | KSh 45,000 | 3/5/6/7 seater. 40D foam, 2yr warranty, buyer-chosen colour. |
| Round coffee table | KSh 16,000 | Priced per table. |
| Solid dining table | KSh 80,000 | 4/6/8 seater at 80/120/150k. Price confirmed. |
| Seven-seater sofa set, ribbed back | KSh 165,000 | 3+2+1+1. 45D memory foam, 2yr warranty. **Video** (39.1s -> 19.3s, stream copy). |
| Panelled bed frame | KSh 75,000 | 5x6 / 6x6 ft at 75/80k. Mattress not included. |
| Nightstands, pair | KSh 30,000 | Sold as a pair. Photographed beside the bed — needs its own shot. |
| Double-decker bed with staircase | KSh 80,000 | 4x6 over 5x6, staircase with storage. **Video re-encoded** (85s/43MB -> 19.2s/2.4MB). |
| Dressing table with round mirror | KSh 35,000 | Includes stool and a lit display column. |
| Green three-seat sofa | KSh 45,000 | Three seats, timber plinth base. |
| Cream sofa set | KSh 45,000 | 3/5/6/7 seater at 45/75/110/140k. 40D foam, 2yr warranty. |
| Wide-headboard bed | KSh 70,000 | 5x6 / 6x6 ft at 70/75k. **Video** (22.6s -> 19.2s, stream copy). |
| Seven-seater sofa set, pocket spring | KSh 175,000 | Seven seats. **Pocket spring**, 2yr warranty. **Video** (25s/12.6MB -> 19.2s/6.3MB, re-encoded). |
| Square coffee table | KSh 30,000 | Still frame taken from the pocket-spring sofa video. |
| Square-arm sofa set | KSh 45,000 | 3/5/6/7 seater at 45/80/115/145k. 40D foam, 2yr warranty. |
| Chenille sofa set | KSh 45,000 | 3/5/6/7 seater at 45/80/115/145k. 40D foam, 2yr warranty. **Ottoman shown in photos — confirm if included.** |
| Rolled-arm sofa set | KSh 50,000 | 3/5/6/7 seater at 50/85/120/150k. 40D foam, 2yr warranty. **Studio renders, not photographs.** |
| Carved mahogany bed | KSh 85,000 | 5x6 / 6x6 ft at 85/90k. **Video** (10.5s, already inside the caps). Matching nightstands KSh 35,000 stated as a spec — they have no photograph of their own yet. |

**Staged, not published** — no price supplied, and the storefront never invents
one: `tan-leather-sofa`, `curved-shoe-rack`.

> **Dining table photography was replaced.** The first three photographs showed
> three visibly different tables. The merchant later supplied two showroom shots
> of one consistent table together with the confirmed pricing, and those are what
> the listing uses. The three earlier images remain ingested but unassigned —
> `dining-set-8-a`, `dining-set-8-b`, `dining-set-8-room` — and need either their
> own listings or deletion.

> **The dressing table was described as "wooden finish" but is painted white**
> with brass-finished hardware. It is listed as built in wood and finished in
> white, which is what the photograph shows. Correct the copy if a timber finish
> option was meant.

> **Video handling.** Three videos were trimmed by stream copy, so no quality was
> lost. Two arrived far over the ADR-003 caps — the double-decker bed at 85s/43MB
> and the pocket-spring sofa at 25s/12.6MB — where even a 19s stream copy would
> have exceeded 8MB. Both were re-encoded at CRF 27 with audio dropped. That is a
> real quality reduction and the only way to meet the cap without a transcoding
> provider. `scripts/ingest-media.mjs` warns rather than silently accepting, and
> `posterAt` in `scripts/ingest.json` picks the poster frame per video.

> **None of the real pieces carries dimensions.** Bed and table sizes are stated
> where the merchant gave them (5x6 ft, 4/6/8 seater) but no piece has width,
> depth and height. This is the largest open gap: the site's whole premise is that
> every listing carries its numbers, and right now only the invented placeholder
> products do.

**Placeholder pieces.** The remaining 16 products are placeholders with generated
orthographic elevation plates (`scripts/gen-plates.mjs`), drawn from each piece's
declared dimensions so the anchor boxes are measured geometry. Their copy, prices
and names are **invented for development** and must be removed before launch.

---

## 7. Definition of done — status

| # | Criterion | Status |
|---|---|---|
| 1 | `typecheck`, `lint`, `build` clean | **Yes** — `tsc --noEmit`, `eslint .`, `next build` all clean |
| 2 | Every route at 360/768/1440, screenshots + self-critique | **Partial.** 54 screenshots in `screenshots/` (9 routes × 3 widths × light/dark). Self-critique not performed — you asked to review them yourself. Automated in its place: `tests/e2e/responsive.spec.ts` proves no horizontal overflow on 13 routes × 3 widths, plus touch-target and mobile-nav checks. |
| 3 | Lighthouse mobile numbers | **Not reported.** Measurement stopped at your request. Results swung 34→94 on the same build with no code change, so nothing from this machine would have been trustworthy. **CLS measured a stable 0.000–0.001** across every run, which is the number the design work targeted. |
| 4 | Rich Results / Schema validation | **Yes** — Schema Markup Validator: `Product`, `BreadcrumbList`, `FurnitureStore`, `VideoObject` each **0 errors, 0 warnings**. Google Rich Results Test not run (needs a public URL). |
| 5 | `/sitemap.xml` + `/robots.txt` valid, published only | **Yes** — 28 URLs, image entries, `lastmod` from row timestamps, unpublished pieces absent |
| 6 | View source shows full content | **Yes** — verified by curl and asserted in e2e |
| 7 | Browsing works with JS disabled | **Yes** — asserted with `javaScriptEnabled: false` |
| 8 | axe clean; keyboard path to cart | **Yes** — 11 route types × light and dark, 0 violations; keyboard purchase path, variant selection, dimension overlay, focus-trapped viewer all asserted |
| 9 | Published product appears after `revalidateTag` | **Not demonstrated end to end.** The tagging is in place and `revalidate.ts` is the single helper, but proving publish-to-visible needs the admin write path and a live database, both out of this phase. |
| 10 | `docs/progress.md` handoff | This file |

**Test totals:** 41 unit assertions, 224 Playwright assertions (desktop + mobile), all passing.

---

## 8. Deviations

1. **npm, not pnpm.** The DoD says `pnpm typecheck`; `docs/dependencies.md` lists
   npm as the toolchain and corepack cannot install pnpm here without admin rights.
   Scripts are `npm run typecheck` / `lint` / `test` / `test:e2e`.
2. **`server-only` added and pinned** (0.0.1). Required by CLAUDE.md, absent from
   `docs/dependencies.md`, and not a transitive dependency of `next`. Recorded there.
3. **`ffmpeg-static` added as a devDependency** to trim the merchant video from
   27.2s to 19.3s (stream copy, no re-encode, `+faststart`) against the ADR-003
   20-second cap. Build tooling only; nothing ships it.
4. **`noUncheckedIndexedAccess` not enabled.** I turned it on, it broke
   `src/lib/money.ts` — another workstream's file — so I removed it rather than
   edit outside my lane. Worth revisiting jointly.
5. **Three typefaces, not two.** The brief says two; `docs/design-brief.md` names
   three. Inter and Inter Tight are one superfamily in two optical widths, so this
   reads as two voices: a grotesk and a mono.
6. **`.column-rules` unused** — see §2, the decoration removed on purpose.

---

## 9. Known gaps

1. **NAP is partly confirmed.** Name, address (`Diamond Plaza, Parklands`) and
   phone (`+254 719 286 328`) come from the merchant and are live in
   `src/lib/site.ts` and the `FurnitureStore` JSON-LD. **Still placeholder:** the
   email address, the geo coordinates (approximated from the Diamond Plaza
   landmark — a wrong pin sends customers to the wrong door), the opening hours
   and `SAME_AS`. All must match the Google Business Profile byte for byte.

2. **`queries.ts` is unexercised** — see §5.
3. **Placeholder catalogue copy** must be removed before launch — see §6.
4. **No `icon.svg`.** `Organization.logo` and `FurnitureStore.logo` point at
   `/icon.svg`, which does not exist yet.
5. **Real pieces have no dimensions**, which undercuts the site's central promise
   on exactly the pieces that are real. Highest-value thing to fix.
6. **JS is ~179 KB gzipped on the product page**, over the 150 KB budget. About
   115 KB of that is React 19 + the Next client runtime and is not reducible
   without dropping the framework; app code is ~64 KB. No stray dependency is in
   the bundle — checked.
7. **Video is `local` provider.** The `<Media>` provider branch and the Mux escape
   hatch from ADR-003 exist but are unexercised.
8. **Merchant photography is mixed, and some of it is CGI.** The rolled-arm sofa
   set and the curved shoe rack are studio renders rather than photographs of
   built pieces; the corduroy sofa has both a render and real workshop shots.
   The rest are phone photos taken in the workshop, on the street or in
   customers' homes. They do not read as one catalogue, and a shopper cannot
   currently tell which images show a real piece. Worth resolving before launch:
   either reshoot, or label renders as such.

9. **Gallery provenance is unverified — the most serious open risk.** `/gallery`
   is live, fed by `media-source/gallery/` via `scripts/ingest-gallery.mjs`. Of the
   first 11 photographs, several are plainly other retailers' product photography:
   one carries a "SOFA LAND" price tag at GBP 1,249, one is a West Elm catalogue
   shot, and two carry Xiaohongshu watermarks. Publishing them under this
   merchant's gallery both misrepresents the workshop's own work and reproduces
   third-party photography without licence. Either restrict the gallery to work
   this workshop built, or label it explicitly as inspiration. It is a data change
   in `media-source/gallery/` plus one line of copy on the page.

---

## 10. Interfaces exposed

```ts
// Catalogue reads — cached and tagged
import { getCategories, getCategory, getListing, getProduct, getRelated,
         getFeatured, searchProducts, getPublishedForSitemap,
         getAllProductSlugs, getAllCategorySlugs,
         catalogueSourceName } from '@/lib/catalog/source';

// Cache invalidation — the ONLY sanctioned path (ADR-004)
import { revalidateProduct, revalidateCategory, revalidateCatalogue,  // Server Actions
         expireProduct, expireCatalogue } from '@/lib/catalog/revalidate';

// Structured data
import { productJsonLd, breadcrumbJsonLd, videoObjectJsonLd,
         organizationJsonLd, furnitureStoreJsonLd } from '@/lib/seo/schema';
import { JsonLd } from '@/lib/seo/json-ld';

// Cart — stub, owned by the cart phase. No price argument, by design.
import { addToCart } from '@/features/cart/actions';
// (productId: string, variantId: string | null, qty: number) => Promise<Result>
```

Media ingestion: `node scripts/ingest-media.mjs` reads `scripts/ingest.json`,
writes `public/media/` and `src/lib/catalog/generated-real-media.json`. It warns —
rather than silently accepting or rejecting — when a video breaks the ADR-003 caps.

---

## 11. Two bugs worth remembering

**`tailwind-merge` silently dropped a colour.** It has no knowledge of a CSS-first
v4 theme, so it read the fluid type scale `text-step-0` as a text *colour* and
treated it as conflicting with `text-accent-ink`. The primary button lost its
foreground and rendered inherited ink on an accent fill at **2.68:1**. axe caught
it; `cn()` now declares the scale, and there is a regression test.

**A leftover `app/page.tsx` shadowed the storefront home.** `create-next-app`
scaffolding sat at `app/page.tsx` while the real home was at
`app/(storefront)/page.tsx`. Same URL, no build error, no type error — the
boilerplate simply won. `tests/e2e/storefront.spec.ts` now asserts the home page is
the storefront.

---

## 12. First release — what changed for launch

The invented sample catalogue is **switched off**. `NEXT_PUBLIC_INCLUDE_SAMPLE_CATALOGUE`
must equal the literal string `true` to include it, so forgetting the variable
excludes the samples rather than publishing fabricated prices. Only
merchant-supplied stock is live — 23 pieces across seating (9), beds (9),
tables (4) and storage (1).

**Price on request.** `basePriceMinor` is nullable. Four pieces have no settled
price: they render "Ask price" with a call-the-showroom action instead of
add-to-cart, and their `Product` JSON-LD omits the `Offer` block entirely rather
than emitting an offer without a price. Unpriced pieces are excluded from
price-band filters and sort to the end of a price sort.

**Email removed.** `SHOWROOM.email` is null, so the contact page, the showroom
page and both JSON-LD blocks omit it. Setting it in `src/lib/site.ts` brings it
back everywhere at once.

**Address and phone are real** — Diamond Plaza, Parklands and +254 719 286 328.
The map coordinates are still approximated from the landmark and the opening
hours are still assumed; both need confirming against the Google Business Profile.

### The signature element is currently dormant

The dimension overlay — the one bold idea in the design — draws only when a piece
has both `dimensions` and a measured anchor box on its image. **No merchant piece
has either**, so it does not appear anywhere on the live site. Two e2e tests are
skipped carrying that reason rather than deleted; they come back the moment
measurements arrive. Until then the site reads as a competent catalogue rather
than the spec-sheet idea it was designed around.

### Before this is a public launch rather than a preview

1. Dimensions for the real pieces (see above).
2. Prices for the four "Ask price" pieces, if they are meant to be priced.
3. A real email address.
4. Confirm the map pin and opening hours.
5. Resolve gallery provenance — see section 9.
6. Set `NEXT_PUBLIC_SITE_URL` to the real domain, or every canonical, OG image
   and sitemap URL will point at `localhost`.
