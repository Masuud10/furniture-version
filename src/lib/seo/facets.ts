import type { ListingQuery } from '@/lib/catalog/types';

/**
 * Faceted navigation is the classic e-commerce crawl trap: four filters with five
 * values each generate hundreds of near-duplicate URLs that eat crawl budget and
 * split ranking signals across pages that are all the same page.
 *
 * So: only the facet combinations with real search demand are indexable. Each gets
 * a self-canonical and its own copy. Everything else is `noindex, follow` and
 * canonicalises to the bare category URL — crawlable, followable, not indexed.
 *
 * A combination earns a place here when someone actually searches for it
 * ("leather sofa", "oak dining table"), not because the filter exists.
 */
export interface IndexableFacet {
  categorySlug: string;
  material: string;
  /** Overrides the category title. Written for the query, not stuffed with it. */
  title: string;
  description: string;
  /** Replaces the category blurb as the page's own copy. */
  intro: string;
}

export const INDEXABLE_FACETS: readonly IndexableFacet[] = [
  {
    categorySlug: 'seating',
    material: 'Fabric',
    title: 'Fabric sofa sets',
    description:
      'Fabric sofa sets made to order in Nairobi, in three, five, six or seven seats and the colour you choose. Pay cash when it arrives.',
    intro:
      'Every fabric set here is built to order, which means the colour is a choice rather than whatever is in stock. Bring a cushion or a paint chip to the showroom and we will match against it. Seat counts run from three to seven off the same frame, so the size is a separate decision from the design.',
  },
  {
    categorySlug: 'tables',
    material: 'Mahogany',
    title: 'Solid mahogany tables',
    description:
      'Solid mahogany dining tables and coffee tables made to order in Nairobi. Pay cash when it arrives.',
    intro:
      'These are solid mahogany tops, not veneered board. That matters in ten years: a scratch in a solid top sands out and is re-oiled, and a scratch through a veneer exposes the substrate underneath and cannot be repaired.',
  },
  {
    categorySlug: 'beds',
    material: 'Mahogany',
    title: 'Solid mahogany beds',
    description:
      'Solid mahogany bed frames made to order in Nairobi, sized for 5 by 6 and 6 by 6 foot mattresses. Pay cash when it arrives.',
    intro:
      'Built for the mattress sizes actually sold here — 5 by 6 and 6 by 6 foot. Every frame bolts together rather than being glued, so it comes apart when you move house instead of staying behind. Mattresses are not included.',
  },
];

export function findIndexableFacet(
  categorySlug: string,
  material: string | null,
): IndexableFacet | null {
  if (!material) return null;
  return (
    INDEXABLE_FACETS.find((f) => f.categorySlug === categorySlug && f.material === material) ?? null
  );
}

/** A listing is filtered when anything other than page number is set. */
export function isFiltered(query: ListingQuery): boolean {
  return query.material !== null || query.priceBand !== null || query.sort !== 'featured';
}
