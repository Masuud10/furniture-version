import Link from 'next/link';

import type { Crumb } from '@/lib/seo/schema';

/**
 * Breadcrumbs are visible, not markup-only. The same `crumbs` array feeds this
 * component and `breadcrumbJsonLd`, so the two cannot disagree — which is exactly
 * what the Rich Results Test checks for.
 */
export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  const last = crumbs.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="text-step--1">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-ink-muted">
        {crumbs.map((crumb, i) => (
          <li key={crumb.path} className="flex items-center gap-2">
            {i === last ? (
              <span aria-current="page" className="text-ink">
                {crumb.name}
              </span>
            ) : (
              <>
                <Link href={crumb.path} className="underline-offset-4 hover:text-ink hover:underline">
                  {crumb.name}
                </Link>
                <span aria-hidden="true" className="text-rule-strong">
                  /
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
