import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { isCatalogueBacked } from './client';
import {
  dbGetAllPublished,
  dbGetCategories,
  dbGetFeatured,
  dbGetListing,
  dbGetProduct,
  dbGetRelated,
  dbSearch,
} from './queries';
import { FIXTURE_CARDS, FIXTURE_CATEGORIES, FIXTURE_FEATURED, FIXTURE_PRODUCTS } from './fixtures';
import {
  PER_PAGE,
  PRICE_BANDS,
  type CategorySummary,
  type ListingQuery,
  type ListingResult,
  type ProductCardModel,
  type ProductDetailModel,
} from './types';

/**
 * The catalogue, cached and tagged.
 *
 * Caching primitive: the `'use cache'` directive with `cacheTag`/`cacheLife` from
 * `next/cache`, enabled by `cacheComponents: true` in next.config.ts. On Next
 * 16.3.1 these are the un-prefixed, non-`unstable_` exports — `unstable_cache`
 * still exists but is the older primitive. Verified against node_modules, not
 * from memory; see docs/progress.md.
 *
 * Tags, matching ADR-004:
 *     products            every listing that contains products
 *     product:<slug>      one product page
 *     category:<slug>     one category listing
 *
 * `cacheLife` supplies the time-based backstop ADR-004 asks for, so a missed
 * `revalidateTag` goes stale in hours rather than forever.
 *
 * Every function falls back to fixtures when Supabase is not configured. That is
 * what lets the storefront be built, screenshotted and audited before the schema
 * exists; it is not a production code path, and `catalogueSourceName()` reports
 * which one is live.
 */

export function catalogueSourceName(): 'supabase' | 'fixtures' {
  return isCatalogueBacked() ? 'supabase' : 'fixtures';
}

/* -------------------------------------------------------------------------- */
/* Fixture-side filtering, so both sources answer a ListingQuery identically    */
/* -------------------------------------------------------------------------- */

function fixtureListing(query: ListingQuery): ListingResult {
  const inCategory = FIXTURE_CARDS.filter((p) => p.categorySlug === query.categorySlug);

  const materials = [...new Set(inCategory.flatMap((p) => p.materials))].sort();

  let items = inCategory;

  if (query.material) {
    items = items.filter((p) => p.materials.includes(query.material as string));
  }

  const band = PRICE_BANDS.find((b) => b.slug === query.priceBand);
  if (band) {
    items = items.filter((p) => {
      // A piece with no settled price cannot belong to a price band. Excluding it
      // is right: the shopper asked to see things in a range, and this is not
      // known to be in it.
      if (p.basePriceMinor === null) return false;
      const price = BigInt(p.basePriceMinor);
      if (band.minMinor !== null && price < BigInt(band.minMinor)) return false;
      if (band.maxMinor !== null && price >= BigInt(band.maxMinor)) return false;
      return true;
    });
  }

  const sorted = [...items];

  // Unpriced pieces sort to the end whichever direction is chosen. They have no
  // position on a price axis, and burying them at the bottom is less misleading
  // than treating an unknown price as zero.
  const byPrice = (dir: 1 | -1) => (a: ProductCardModel, b: ProductCardModel) => {
    if (a.basePriceMinor === null && b.basePriceMinor === null) return 0;
    if (a.basePriceMinor === null) return 1;
    if (b.basePriceMinor === null) return -1;
    const left = BigInt(a.basePriceMinor);
    const right = BigInt(b.basePriceMinor);
    if (left === right) return 0;
    return left < right ? -dir : dir;
  };

  switch (query.sort) {
    case 'price-asc':
      sorted.sort(byPrice(1));
      break;
    case 'price-desc':
      sorted.sort(byPrice(-1));
      break;
    case 'newest':
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case 'featured':
    default:
      break;
  }

  const total = sorted.length;
  const from = (query.page - 1) * PER_PAGE;

  return {
    items: sorted.slice(from, from + PER_PAGE),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    perPage: PER_PAGE,
    materials,
  };
}

/* -------------------------------------------------------------------------- */
/* Public reads                                                                */
/* -------------------------------------------------------------------------- */

export async function getCategories(): Promise<readonly CategorySummary[]> {
  'use cache';
  cacheTag('products');
  cacheLife('days');

  if (!isCatalogueBacked()) return FIXTURE_CATEGORIES;
  return dbGetCategories();
}

export async function getCategory(slug: string): Promise<CategorySummary | null> {
  'use cache';
  cacheTag('products', `category:${slug}`);
  cacheLife('days');

  const all = isCatalogueBacked() ? await dbGetCategories() : FIXTURE_CATEGORIES;
  return all.find((c) => c.slug === slug) ?? null;
}

export async function getListing(query: ListingQuery): Promise<ListingResult> {
  'use cache';
  cacheTag('products', `category:${query.categorySlug}`);
  cacheLife('hours');

  if (!isCatalogueBacked()) return fixtureListing(query);
  return dbGetListing(query);
}

export async function getProduct(slug: string): Promise<ProductDetailModel | null> {
  'use cache';
  cacheTag('products', `product:${slug}`);
  cacheLife('days');

  if (!isCatalogueBacked()) return FIXTURE_PRODUCTS.find((p) => p.slug === slug) ?? null;
  return dbGetProduct(slug);
}

export async function getRelated(
  slug: string,
  categorySlug: string,
): Promise<readonly ProductCardModel[]> {
  'use cache';
  cacheTag('products', `category:${categorySlug}`);
  cacheLife('days');

  if (!isCatalogueBacked()) {
    return FIXTURE_CARDS.filter((p) => p.categorySlug === categorySlug && p.slug !== slug).slice(0, 4);
  }
  return dbGetRelated(slug, categorySlug);
}

export async function getFeatured(): Promise<readonly ProductCardModel[]> {
  'use cache';
  cacheTag('products');
  cacheLife('days');

  if (!isCatalogueBacked()) return FIXTURE_FEATURED;
  return dbGetFeatured();
}

export async function searchProducts(term: string): Promise<readonly ProductCardModel[]> {
  'use cache';
  cacheTag('products');
  cacheLife('hours');

  const cleaned = term.trim();
  if (cleaned.length === 0) return [];

  if (!isCatalogueBacked()) {
    const needle = cleaned.toLowerCase();
    return FIXTURE_CARDS.filter((p) =>
      [p.name, p.sku, p.categoryName, ...p.materials].join(' ').toLowerCase().includes(needle),
    );
  }
  return dbSearch(cleaned);
}

/** Only published products, with the row's own `updated_at`, for the sitemap. */
export async function getPublishedForSitemap(): Promise<
  ReadonlyArray<{ slug: string; updatedAt: string; image: string | null }>
> {
  'use cache';
  cacheTag('products');
  cacheLife('hours');

  if (!isCatalogueBacked()) {
    return FIXTURE_CARDS.map((p) => ({
      slug: p.slug,
      updatedAt: p.updatedAt,
      image: p.primaryImage?.providerRef ?? null,
    }));
  }
  return dbGetAllPublished();
}

/** Feeds `generateStaticParams`. */
export async function getAllProductSlugs(): Promise<string[]> {
  'use cache';
  cacheTag('products');
  cacheLife('hours');

  if (!isCatalogueBacked()) return FIXTURE_CARDS.map((p) => p.slug);
  const rows = await dbGetAllPublished();
  return rows.map((r) => r.slug);
}

export async function getAllCategorySlugs(): Promise<string[]> {
  'use cache';
  cacheTag('products');
  cacheLife('hours');

  const all = isCatalogueBacked() ? await dbGetCategories() : FIXTURE_CATEGORIES;
  return all.map((c) => c.slug);
}
