# Storefront read contract

What the public pages read, and the exact column names they expect. This is the
interface between the storefront and the schema; it was written before the schema
existed, so treat any mismatch as a bug in **this** document, not in the schema —
open it, fix it here, and change `src/lib/catalog/queries.ts` to match.

Only `anon`-visible rows are ever read: `products.status = 'published'` and the
variants and media belonging to them. Nothing here needs a session, which is why
catalogue reads use a cookie-free client (see below).

---

## 1. Why the storefront does not use `src/lib/supabase/server.ts`

Catalogue pages are static. The moment a client calls `cookies()`, the route opts
out of static rendering and every product page becomes a database round trip.

So the storefront reads through `src/lib/catalog/client.ts` — a plain
`createClient` from `@supabase/supabase-js` with the anon key, `persistSession:
false`, and no cookie binding at all. Published rows are readable by `anon` under
RLS, so this client needs no session.

The cookie-bound `@supabase/ssr` client stays the right tool for `/account/*` and
`/admin/*`. The two coexist on purpose.

---

## 2. Tables and columns

### `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `slug` | text | lowercase, hyphenated, stable — a change needs a 301 in `next.config.ts` |
| `name` | text | rendered as the `<h1>` on the listing |
| `blurb` | text | one or two sentences; feeds the meta description |
| `position` | int | listing order on `/collections` |
| `updated_at` | timestamptz | goes into `<lastmod>` — must be the row's own value |

### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `slug` | text | as above |
| `name` | text | |
| `sku` | text | rendered in mono |
| `summary` | text | ≤ 155 chars of plain text — meta description and OG card |
| `description_md` | text | paragraphs separated by blank lines; **no HTML** (see §4) |
| `care_md` | text | same |
| `base_price_minor` | bigint | KES cents |
| `currency` | char(3) | |
| `stock_qty` | int **nullable** | **null means made to order**, `0` means unavailable |
| `lead_time_days` | int | |
| `dimensions` | jsonb | `{ w, d, h, seatH? }` in **millimetres**, all numbers |
| `materials` | text[] | drives the material filter and `Product.material` |
| `status` | enum | storefront reads `'published'` only |
| `is_featured` | bool | the home page strip |
| `position` | int | the `featured` sort order |
| `price_valid_until` | date **nullable** | `Offer.priceValidUntil`; falls back to `updated_at` + 1 year |
| `search_vector` | tsvector | `websearch` full-text; see §3 |
| `updated_at` | timestamptz | `<lastmod>` |
| `category_id` | uuid | FK |

### `product_variants`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | appears in `?variant=`, so it must be stable |
| `product_id` | uuid | |
| `name` | text | the accessible name of the swatch — never colour alone |
| `material` | text | |
| `swatch_hex` | text nullable | decoration only |
| `price_delta_minor` | bigint | may be negative |
| `sku` | text nullable | |
| `stock_qty` | int nullable | same null/0 rule as `products` |

### `media_assets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `product_id` | uuid | |
| `variant_id` | uuid **nullable** | null = product-level; set = swaps in when that finish is chosen |
| `kind` | enum | `'image' \| 'video'` |
| `provider` | text | `'supabase'` today; `'mux'`/`'youtube'` are the escape hatch (ADR-003) |
| `provider_ref` | text | storage path within `product-media`, or a playback id |
| `alt_text` | text **not null** | describes the image; the NOT NULL is the point |
| `width`, `height` | int | drive `aspect-ratio` — **zero CLS depends on these** |
| `blur_data_url` | text nullable | extracted at upload |
| `poster_path` | text nullable | **required when `kind = 'video'`** — a video without one is skipped |
| `duration_s` | int nullable | seconds; becomes ISO 8601 in `VideoObject` |
| `position` | int | gallery order; position 0 of the product-level images is the LCP element |
| `anchors` | jsonb nullable | see below |

#### `media_assets.anchors` — required by the signature element

```json
{ "x1": 0.128, "y1": 0.365, "x2": 0.873, "y2": 0.676 }
```

The bounding box of the piece **inside the frame**, as fractions of the image,
origin top-left. The dimension annotations are drawn from this crossed with
`products.dimensions`, which is what makes them data rather than decoration.

Null is handled: the overlay simply does not draw. It is not an error, but the
signature element is missing on that image, so the uploader should capture it.

---

## 3. Search

`/search` calls:

```ts
.textSearch('search_vector', term, { type: 'websearch', config: 'english' })
```

`search_vector` should cover at least `name`, `sku`, `materials` and `summary`.
Verified against `@supabase/postgrest-js` as installed: the options are
`{ config?: string; type?: 'plain' | 'phrase' | 'websearch' }`.

---

## 4. Two things that would break the storefront

**HTML in `description_md` / `care_md`.** They are rendered as text nodes split on
blank lines — deliberately not a markdown renderer and deliberately not
`dangerouslySetInnerHTML`, so there is no injection surface. HTML in those columns
will render as visible angle brackets. If real markdown is needed, that is the
moment to add a sanitising renderer.

**`stock_qty = 0` used to mean "made to order".** Null means made to order and
maps to `schema.org/PreOrder`; zero maps to `OutOfStock` and blocks the cart
button. Getting these the wrong way round would hide most of the catalogue from
search. There is a unit test pinning this.

---

## 5. Cache invalidation

Every admin mutation must call the helpers in `src/lib/catalog/revalidate.ts` —
not `revalidateTag` directly. Tags attached by `src/lib/catalog/source.ts`:

    products            every listing that contains products
    product:<slug>      one product page
    category:<slug>     one category listing

---

## 6. Until the schema exists

`src/lib/catalog/source.ts` falls back to `fixtures.ts` whenever
`NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is unset.
`catalogueSourceName()` reports which source is live. Set both and the same
functions read Postgres instead — no component changes.
