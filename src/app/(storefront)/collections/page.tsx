import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Media } from '@/components/ui/media';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/schema';
import { getCategories } from '@/lib/catalog/source';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Every collection: sofas and chairs, tables and desks, storage and beds. Each piece listed with its dimensions, materials and lead time.',
  alternates: { canonical: '/collections' },
  openGraph: {
    type: 'website',
    url: '/collections',
    title: 'Collections',
    description: 'Sofas and chairs, tables and desks, storage and beds — made to order in Nairobi.',
  },
};

const crumbs: readonly Crumb[] = [
  { name: 'Home', path: '/' },
  { name: 'Collections', path: '/collections' },
];

export default async function CollectionsPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <h1 className="mt-4 text-step-5">Collections</h1>
      <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
        Four collections, built in the same workshop from the same timber. Every listing
        carries its full dimensions, because that is the question you actually have.
      </p>

      <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category, i) => (
          <li key={category.slug} className="border-t border-rule pt-4">
            {category.cover && (
              <Link href={`/collections/${category.slug}`} tabIndex={-1} aria-hidden="true">
                <Media
                  asset={category.cover}
                  sizes="(min-width: 64rem) 23vw, (min-width: 40rem) 47vw, 92vw"
                  priority={i === 0}
                  className="mb-4 border border-rule"
                />
              </Link>
            )}
            <h2 className="text-step-2">
              <Link
                href={`/collections/${category.slug}`}
                className="underline-offset-4 hover:underline"
              >
                {category.name}
              </Link>
            </h2>
            <p className="mt-2 text-step-0 text-ink-muted">{category.blurb}</p>
            <p className="mt-3 font-mono text-step--1 tabular-nums text-ink-muted">
              {category.productCount} pieces
            </p>
          </li>
        ))}
      </ul>

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
