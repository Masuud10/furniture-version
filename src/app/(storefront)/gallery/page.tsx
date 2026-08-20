import type { Metadata } from 'next';
import Link from 'next/link';

import { GalleryGrid } from '@/components/storefront/gallery-grid';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { getGalleryPage } from '@/lib/catalog/gallery';
import type { RawSearchParams } from '@/lib/catalog/listing-params';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/schema';
import { absoluteUrl } from '@/lib/seo/urls';
import { MERCHANT, SHOWROOM } from '@/lib/site';

type Props = { searchParams: Promise<RawSearchParams> };

// Blocking SSR: the page number lives in `searchParams`, and the grid must be in
// the HTML rather than swapped in by JavaScript.
export const instant = false;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const raw = sp['page'];
  const page = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? '1', 10);
  const current = Number.isFinite(page) && page > 0 ? page : 1;
  const suffix = current > 1 ? ` — Page ${current}` : '';

  return {
    title: `Gallery${suffix}`,
    description: `Photographs of finished work by ${MERCHANT} — sofas, beds, tables and storage, in the showroom and in customers' homes.`,
    alternates: { canonical: current > 1 ? `/gallery?page=${current}` : '/gallery' },
    openGraph: {
      type: 'website',
      url: current > 1 ? `/gallery?page=${current}` : '/gallery',
      title: `Gallery${suffix}`,
      description: `Photographs of finished work by ${MERCHANT}.`,
    },
  };
}

const crumbs: readonly Crumb[] = [
  { name: 'Home', path: '/' },
  { name: 'Gallery', path: '/gallery' },
];

export default async function GalleryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp['page'];
  const parsed = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? '1', 10);
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const { photos, page, pageCount, total } = await getGalleryPage(requested);

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <header className="mt-4">
        <h1 className="text-step-5">Gallery</h1>
        <p className="mt-3 max-w-(--measure) text-step-1 text-ink-muted">
          Finished work — in the showroom, in the workshop, and in the rooms it was
          built for. No prices here; when you see something you want, the collections
          carry the sizes and what it costs.
        </p>
        <p className="mt-3 font-mono text-step--1 tabular-nums text-ink-muted">
          {total} {total === 1 ? 'photograph' : 'photographs'}
          {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
        </p>
      </header>

      <div className="mt-8">
        {photos.length > 0 ? (
          <GalleryGrid photos={photos} />
        ) : (
          <div className="border-t border-rule pt-6">
            <h2 className="text-step-2">No photographs here yet</h2>
            <p className="mt-2 max-w-(--measure) text-step-0 text-ink-muted">
              The gallery fills up as pieces leave the workshop. In the meantime, every
              piece in the collections carries its own photographs.
            </p>
            <div className="mt-5">
              <ButtonLink href="/collections" variant="secondary">
                Browse collections
              </ButtonLink>
            </div>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Gallery pagination" className="mt-10 border-t border-rule pt-4">
          <ul className="flex flex-wrap items-center gap-2">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <Link
                  href={n > 1 ? `/gallery?page=${n}` : '/gallery'}
                  aria-current={n === page ? 'page' : undefined}
                  aria-label={`Page ${n}`}
                  className={
                    n === page
                      ? 'inline-block border border-accent bg-accent-quiet px-3 py-1 font-mono text-step--1 tabular-nums text-ink'
                      : 'inline-block border border-rule px-3 py-1 font-mono text-step--1 tabular-nums text-ink-muted hover:border-rule-strong hover:text-ink'
                  }
                >
                  {n}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section className="mt-14 border-t border-rule pt-6">
        <h2 className="text-step-2">Seen something you want?</h2>
        <p className="mt-2 max-w-(--measure) text-step-0 text-ink-muted">
          Most of what is here is on the floor at {SHOWROOM.streetAddress}, and anything
          in the collections can be built in a different size or a different fabric.
          Call and describe the photograph — we will know the one.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/collections">Browse collections</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Ask about a piece
          </ButtonLink>
        </div>
      </section>

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ImageGallery',
          name: `${MERCHANT} — Gallery`,
          url: absoluteUrl('/gallery'),
          // Only the images actually on this page, never the whole set.
          image: photos.map((p) => absoluteUrl(p.path)),
        }}
      />
    </div>
  );
}
