import { siteUrl } from '@/lib/site';

/** Absolute URL for structured data and sitemaps, which may not use relative paths. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Trim to a whole word at `max` characters. Meta descriptions are cut at ~155. */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}

/**
 * A canonical for a paginated listing.
 * Page 1 canonicalises to the bare URL; page n keeps `?page=n`, because a
 * paginated page is its own page and self-canonicalises. `rel=next`/`rel=prev`
 * is deliberately absent — Google retired it and it earns nothing.
 */
export function listingCanonical(categorySlug: string, page: number): string {
  return page > 1 ? `/collections/${categorySlug}?page=${page}` : `/collections/${categorySlug}`;
}
