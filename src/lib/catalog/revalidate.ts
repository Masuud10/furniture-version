import 'server-only';

import { revalidateTag, updateTag } from 'next/cache';

/**
 * The one place catalogue cache tags are invalidated.
 *
 * ADR-004 is explicit that every admin mutation goes through a single helper
 * rather than each form calling the cache API itself, because the failure mode of
 * a forgotten tag is a merchant staring at a stale page with no error anywhere.
 * This is that helper, and it is the interface the admin phase should call.
 *
 * Tags match exactly what `source.ts` attaches:
 *
 *     products            every listing that contains products
 *     product:<slug>      one product page
 *     category:<slug>     one category listing
 *
 * ── Which primitive ──────────────────────────────────────────────────────────
 * Next 16 has two, and they are not interchangeable:
 *
 *   updateTag(tag)                  expires the tag *and* refreshes the current
 *                                   request's cache, giving read-your-own-writes.
 *                                   Server Actions only. This is what makes
 *                                   publish-to-visible deterministic for the
 *                                   merchant instead of "wait for the cache".
 *
 *   revalidateTag(tag, profile)     expires the tag against a cacheLife profile.
 *                                   Takes two arguments in Next 16 — verified
 *                                   against node_modules, the one-argument form
 *                                   from earlier versions no longer compiles.
 *                                   Usable outside a Server Action.
 *
 * The admin publish path is a Server Action, so it wants `updateTag`. The
 * `expire*` variants exist for a webhook or route handler, which cannot use it.
 */

/* -------------------------------------------------------------------------- */
/* Server Action path — read-your-own-writes                                   */
/* -------------------------------------------------------------------------- */

/** Publishing, unpublishing, archiving or editing one product. */
export function revalidateProduct(slug: string, categorySlug?: string): void {
  updateTag(`product:${slug}`);
  // Listings embed product cards, so they go stale the moment a product changes.
  updateTag('products');
  if (categorySlug) updateTag(`category:${categorySlug}`);
}

/** A category rename or reorder — anything that changes what a listing contains. */
export function revalidateCategory(slug: string): void {
  updateTag(`category:${slug}`);
  updateTag('products');
}

/** The blunt instrument: everything catalogue-shaped. */
export function revalidateCatalogue(): void {
  updateTag('products');
}

/* -------------------------------------------------------------------------- */
/* Non-Server-Action path — webhooks and route handlers                        */
/* -------------------------------------------------------------------------- */

const CATALOGUE_PROFILE = 'days';

export function expireProduct(slug: string, categorySlug?: string): void {
  revalidateTag(`product:${slug}`, CATALOGUE_PROFILE);
  revalidateTag('products', CATALOGUE_PROFILE);
  if (categorySlug) revalidateTag(`category:${categorySlug}`, CATALOGUE_PROFILE);
}

export function expireCatalogue(): void {
  revalidateTag('products', CATALOGUE_PROFILE);
}
