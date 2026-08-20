import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FilterRail } from '@/components/storefront/filter-rail';
import { Pagination } from '@/components/storefront/pagination';
import { ProductGrid } from '@/components/storefront/product-grid';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { parseListingParams, type RawSearchParams } from '@/lib/catalog/listing-params';
import { getCategory, getListing } from '@/lib/catalog/source';
import { findIndexableFacet, isFiltered } from '@/lib/seo/facets';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/schema';
import { listingCanonical, truncate } from '@/lib/seo/urls';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

/**
 * Blocking SSR rather than a streamed shell.
 *
 * Under Cache Components, reading `searchParams` outside a `<Suspense>` boundary
 * is only allowed on a route that opts into blocking — `instant = false`. That is
 * exactly what is wanted here: a streamed Suspense payload arrives as hidden
 * markup that JavaScript has to swap in, so a listing built that way is blank
 * with JS disabled. Blocking puts the whole grid in the HTML response.
 *
 * The data underneath is still `'use cache'` and tagged, so this is a cache read
 * and not a database round trip.
 */
export const instant = false;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) return {};

  const query = parseListingParams(slug, sp);
  const facet = findIndexableFacet(slug, query.material);

  // An allowlisted facet is a page in its own right: its own title, its own copy,
  // its own canonical.
  if (facet) {
    return {
      title: facet.title,
      description: facet.description,
      alternates: { canonical: `/collections/${slug}?material=${encodeURIComponent(facet.material)}` },
      robots: { index: true, follow: true },
      openGraph: { type: 'website', title: facet.title, description: facet.description },
    };
  }

  // Everything else that is filtered is a near-duplicate of the category page.
  // Followable so the products behind it are still discovered; not indexed, so
  // it does not eat crawl budget or split ranking signals.
  const filtered = isFiltered(query);
  const pageSuffix = query.page > 1 ? ` — Page ${query.page}` : '';

  return {
    title: `${category.name}${pageSuffix}`,
    description: truncate(category.blurb),
    alternates: { canonical: filtered ? `/collections/${slug}` : listingCanonical(slug, query.page) },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: listingCanonical(slug, query.page),
      title: `${category.name}${pageSuffix}`,
      description: truncate(category.blurb),
    },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const category = await getCategory(slug);
  if (!category) notFound();

  // Parsed twice: once to learn the material list, once to validate the material
  // against it. Both reads are cached, so this costs nothing.
  const probe = parseListingParams(slug, sp);
  const firstPass = await getListing({ ...probe, material: null });
  const query = parseListingParams(slug, sp, firstPass.materials);

  const listing = await getListing(query);
  const facet = findIndexableFacet(slug, query.material);

  const crumbs: readonly Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Collections', path: '/collections' },
    { name: category.name, path: `/collections/${slug}` },
  ];

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <header className="mt-4">
        <h1 className="text-step-5">{facet ? facet.title : category.name}</h1>
        <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
          {facet ? facet.intro : category.blurb}
        </p>
        {query.page > 1 && (
          <p className="mt-2 font-mono text-step--1 tabular-nums text-ink-muted">
            Page {query.page} of {listing.pageCount}
          </p>
        )}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-10">
        <aside>
          <FilterRail query={query} materials={listing.materials} resultCount={listing.total} />
        </aside>

        <div>
          {listing.items.length > 0 ? (
            <>
              <ProductGrid products={listing.items} priorityCount={1} />
              <Pagination query={query} pageCount={listing.pageCount} />
            </>
          ) : (
            <div className="border-t border-rule pt-6">
              <h2 className="text-step-2">Nothing matches those filters</h2>
              <p className="mt-2 max-w-(--measure) text-step-0 text-ink-muted">
                There is nothing in {category.name.toLowerCase()} at that combination yet.
                Clear the filters to see the whole collection, or tell us what you are
                looking for and we will say whether we can build it.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href={`/collections/${slug}`} variant="secondary">
                  Clear filters
                </ButtonLink>
                <ButtonLink href="/contact" variant="quiet">
                  Ask about a custom piece
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
