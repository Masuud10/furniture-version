import {
  PRICE_BANDS,
  SORT_OPTIONS,
  type ListingQuery,
  type PriceBandSlug,
  type Sort,
} from './types';

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isSort(value: string | null): value is Sort {
  return value !== null && (SORT_OPTIONS as readonly string[]).includes(value);
}

function isPriceBand(value: string | null): value is PriceBandSlug {
  return value !== null && PRICE_BANDS.some((b) => b.slug === value);
}

/**
 * Read filters off the query string, rejecting anything unrecognised.
 *
 * Unknown values collapse to the default rather than 404ing: a mistyped filter
 * should show the category, not an error page, and an attacker cannot conjure a
 * new indexable URL by inventing a sort order.
 */
export function parseListingParams(
  categorySlug: string,
  searchParams: RawSearchParams,
  knownMaterials: readonly string[] = [],
): ListingQuery {
  const rawMaterial = first(searchParams['material']);
  const material =
    rawMaterial && knownMaterials.length > 0
      ? (knownMaterials.find((m) => m.toLowerCase() === rawMaterial.toLowerCase()) ?? null)
      : rawMaterial;

  const rawSort = first(searchParams['sort']);
  const rawBand = first(searchParams['price']);
  const rawPage = Number.parseInt(first(searchParams['page']) ?? '1', 10);

  return {
    categorySlug,
    material,
    priceBand: isPriceBand(rawBand) ? rawBand : null,
    sort: isSort(rawSort) ? rawSort : 'featured',
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

/**
 * Build a listing URL. Defaults are omitted so the unfiltered page is always the
 * bare path — one canonical URL for the category rather than a family of
 * equivalent ones carrying `?sort=featured&page=1`.
 */
export function buildListingHref(query: ListingQuery, overrides: Partial<ListingQuery> = {}): string {
  const merged: ListingQuery = { ...query, ...overrides };

  // Any filter change returns to page one; page 3 of a different filter is a
  // different set of products and usually does not exist.
  if (
    overrides.material !== undefined ||
    overrides.priceBand !== undefined ||
    overrides.sort !== undefined
  ) {
    merged.page = overrides.page ?? 1;
  }

  const params = new URLSearchParams();
  if (merged.material) params.set('material', merged.material);
  if (merged.priceBand) params.set('price', merged.priceBand);
  if (merged.sort !== 'featured') params.set('sort', merged.sort);
  if (merged.page > 1) params.set('page', String(merged.page));

  const qs = params.toString();
  return `/collections/${merged.categorySlug}${qs ? `?${qs}` : ''}`;
}
