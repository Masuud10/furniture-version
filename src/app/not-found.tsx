import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { getCategories } from '@/lib/catalog/source';
import { fontVariables } from '@/lib/fonts';

/**
 * The root not-found renders outside the storefront layout, so it brings its own
 * shell. It says what happened and what to do next, without apologising.
 */
export default async function NotFound() {
  const categories = await getCategories();

  return (
    <div className={fontVariables}>
      <main id="main" className="mx-auto flex min-h-dvh max-w-(--page-max) flex-col justify-center px-(--page-gutter) py-16">
        <p className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">Error 404</p>
        <h1 className="mt-3 text-step-5">That page is not here</h1>
        <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
          The link may be old, or a piece may have been archived. Nothing is deleted from
          the catalogue, so if you had it saved, search for it by name or SKU and it will
          come back.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/collections">Browse collections</ButtonLink>
          <ButtonLink href="/search" variant="secondary">
            Search
          </ButtonLink>
        </div>

        <nav aria-label="Collections" className="mt-10 border-t border-rule pt-4">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/collections/${category.slug}`}
                  className="inline-block border border-rule px-3 py-1 text-step-0 text-ink-muted hover:border-ink hover:text-ink"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
