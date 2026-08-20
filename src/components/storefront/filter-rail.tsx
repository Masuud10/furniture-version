import Link from 'next/link';

import { buildListingHref } from '@/lib/catalog/listing-params';
import { PRICE_BANDS, SORT_LABELS, SORT_OPTIONS, type ListingQuery } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';

/**
 * Filters are links, not buttons.
 *
 * Every control here is a real `<a href>` pointing at a real URL that renders the
 * filtered listing server-side. That means middle-click opens a new tab, the back
 * button works, a crawler can follow them, and the page needs no JavaScript at
 * all. A button that mutates client state would break all four.
 *
 * Server Component — there is nothing to hydrate.
 */
export function FilterRail({
  query,
  materials,
  resultCount,
}: {
  query: ListingQuery;
  materials: readonly string[];
  resultCount: number;
}) {
  const anyFilter = query.material !== null || query.priceBand !== null;

  return (
    <div className="border-t border-rule pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">Filter</h2>
        {anyFilter && (
          <Link
            href={buildListingHref(query, { material: null, priceBand: null })}
            className="font-mono text-step--1 text-accent underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/*
        The count is announced when it changes. On a full page navigation the
        region is new rather than updated, so this matters most for assistive
        tech that keeps the page alive across soft navigations.
      */}
      <p role="status" aria-live="polite" className="mt-2 font-mono text-step--1 tabular-nums text-ink">
        {resultCount} {resultCount === 1 ? 'piece' : 'pieces'}
      </p>

      {materials.length > 0 && (
        <FilterGroup label="Material">
          {materials.map((material) => (
            <FilterLink
              key={material}
              href={buildListingHref(query, {
                material: query.material === material ? null : material,
              })}
              active={query.material === material}
            >
              {material}
            </FilterLink>
          ))}
        </FilterGroup>
      )}

      <FilterGroup label="Price">
        {PRICE_BANDS.map((band) => (
          <FilterLink
            key={band.slug}
            href={buildListingHref(query, {
              priceBand: query.priceBand === band.slug ? null : band.slug,
            })}
            active={query.priceBand === band.slug}
          >
            {band.label}
          </FilterLink>
        ))}
      </FilterGroup>

      <FilterGroup label="Sort">
        {SORT_OPTIONS.map((sort) => (
          <FilterLink
            key={sort}
            href={buildListingHref(query, { sort })}
            active={query.sort === sort}
          >
            {SORT_LABELS[sort]}
          </FilterLink>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-rule pt-3">
      <h3 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">{label}</h3>
      <ul className="mt-2 flex flex-wrap gap-2 lg:flex-col lg:gap-1">{children}</ul>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'inline-block border px-2 py-1 text-step--1 transition-colors',
          active
            ? 'border-accent bg-accent-quiet text-ink'
            : 'border-rule text-ink-muted hover:border-rule-strong hover:text-ink',
        )}
      >
        {children}
      </Link>
    </li>
  );
}
