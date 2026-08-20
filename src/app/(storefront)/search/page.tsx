import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductGrid } from '@/components/storefront/product-grid';
import { ButtonLink } from '@/components/ui/button';
import { searchProducts, getCategories } from '@/lib/catalog/source';
import type { RawSearchParams } from '@/lib/catalog/listing-params';

type Props = { searchParams: Promise<RawSearchParams> };

export const metadata: Metadata = {
  title: 'Search',
  // A search results page is thin, near-duplicate and infinite. Followable so the
  // products behind it are reachable; never indexed.
  robots: { index: false, follow: true },
};

// Blocking SSR: results must be in the HTML, not swapped in by JavaScript.
export const instant = false;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp['q'];
  const term = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  const [results, categories] = await Promise.all([
    term.trim() ? searchProducts(term) : Promise.resolve([]),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <h1 className="text-step-5">Search</h1>

      {/* A GET form: the query lands in the URL, the page is shareable, and it
          works with JavaScript switched off. */}
      <form action="/search" method="get" role="search" className="mt-6 flex max-w-xl gap-3">
        <label htmlFor="q" className="sr-only">
          Search for a piece
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={term}
          placeholder="Sofa, oak table, wardrobe…"
          className="h-12 w-full border border-rule-strong bg-surface px-3 text-step-0 text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-sm border border-accent bg-accent px-5 font-medium text-accent-ink hover:border-ink hover:bg-ink"
        >
          Search
        </button>
      </form>

      {term.trim() === '' ? (
        <EmptyInvitation categories={categories} heading="Look for a piece by name, timber or size" />
      ) : results.length > 0 ? (
        <>
          <p role="status" aria-live="polite" className="mt-6 font-mono text-step--1 tabular-nums text-ink">
            {results.length} {results.length === 1 ? 'result' : 'results'} for “{term}”
          </p>
          <div className="mt-6">
            <ProductGrid products={results} priorityCount={1} />
          </div>
        </>
      ) : (
        <>
          <p role="status" aria-live="polite" className="mt-6 font-mono text-step--1 text-ink">
            Nothing matches “{term}”.
          </p>
          <EmptyInvitation
            categories={categories}
            heading="Try a broader word, or start from a collection"
          />
        </>
      )}
    </div>
  );
}

/** An empty result is an invitation, not a dead end. */
function EmptyInvitation({
  categories,
  heading,
}: {
  categories: Awaited<ReturnType<typeof getCategories>>;
  heading: string;
}) {
  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="text-step-2">{heading}</h2>
      <p className="mt-2 max-w-(--measure) text-step-0 text-ink-muted">
        Searching works on the piece name, the timber and the SKU — “oak”, “sofa”,
        “ATH-DT-180”. If you know the size you need rather than the name, the
        collections list every piece with its dimensions.
      </p>

      <ul className="mt-5 flex flex-wrap gap-2">
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

      <div className="mt-6">
        <ButtonLink href="/contact" variant="secondary">
          Ask us to build something
        </ButtonLink>
      </div>
    </section>
  );
}
