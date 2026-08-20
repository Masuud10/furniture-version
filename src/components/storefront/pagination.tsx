import Link from 'next/link';

import { buildListingHref } from '@/lib/catalog/listing-params';
import type { ListingQuery } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';

/**
 * Offset pagination with crawlable numbered links.
 *
 * `rel="next"` / `rel="prev"` is deliberately absent: Google retired support for
 * it and it earns nothing. Paginated pages self-canonicalise and rely on these
 * anchors being real, followable links.
 */
export function Pagination({ query, pageCount }: { query: ListingQuery; pageCount: number }) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const current = Math.min(query.page, pageCount);

  return (
    <nav aria-label="Pagination" className="mt-10 border-t border-rule pt-4">
      <ul className="flex flex-wrap items-center gap-2">
        {current > 1 && (
          <li>
            <Link
              href={buildListingHref(query, { page: current - 1 })}
              className="border border-rule px-3 py-1 font-mono text-step--1 text-ink-muted hover:border-ink hover:text-ink"
            >
              Previous
            </Link>
          </li>
        )}

        {pages.map((page) => (
          <li key={page}>
            <Link
              href={buildListingHref(query, { page })}
              aria-current={page === current ? 'page' : undefined}
              aria-label={`Page ${page}`}
              className={cn(
                'inline-block border px-3 py-1 font-mono text-step--1 tabular-nums transition-colors',
                page === current
                  ? 'border-accent bg-accent-quiet text-ink'
                  : 'border-rule text-ink-muted hover:border-rule-strong hover:text-ink',
              )}
            >
              {page}
            </Link>
          </li>
        ))}

        {current < pageCount && (
          <li>
            <Link
              href={buildListingHref(query, { page: current + 1 })}
              className="border border-rule px-3 py-1 font-mono text-step--1 text-ink-muted hover:border-ink hover:text-ink"
            >
              Next
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
