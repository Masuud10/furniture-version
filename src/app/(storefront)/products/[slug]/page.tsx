import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AddToCart } from '@/components/storefront/add-to-cart';
import { ProductGallery } from '@/components/storefront/product-gallery';
import { ProductGrid } from '@/components/storefront/product-grid';
import { VariantProvider } from '@/components/storefront/variant-context';
import { VariantSelector } from '@/components/storefront/variant-selector';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Prose } from '@/components/ui/prose';
import { SpecList, SpecRow } from '@/components/ui/spec-list';
import { formatMm, formatWdh, leadTimeSentence } from '@/lib/catalog/dimensions';
import { getAllProductSlugs, getProduct, getRelated } from '@/lib/catalog/source';
import type { MediaAsset } from '@/lib/catalog/types';
import { JsonLd } from '@/lib/seo/json-ld';
import { breadcrumbJsonLd, productJsonLd, videoObjectJsonLd, type Crumb } from '@/lib/seo/schema';
import { truncate } from '@/lib/seo/urls';
import { PAYMENT_LINE, SHOWROOM } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

// Note: no `dynamicParams` export. Under Cache Components it is rejected as a
// route segment config, because on-demand rendering of params outside
// `generateStaticParams` is the default. A product published after the last build
// therefore still resolves on first request rather than 404ing until the next
// deploy — which is what ADR-004 asks for.

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: truncate(product.summary),
    // The bare product URL. `?variant=` is a client-side reflection of a choice
    // and must never fragment the index across one page per finish.
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      // 'product' is not in Next's OpenGraph type union — verified against
      // node_modules/next/dist/lib/metadata/types/opengraph-types.d.ts. The
      // product semantics are carried by the Product JSON-LD instead.
      type: 'website',
      title: product.name,
      description: truncate(product.summary),
      url: `/products/${slug}`,
      // No `images` here on purpose. The colocated `opengraph-image.tsx` supplies
      // the card via the file convention; setting `images` in metadata overrides
      // it, which would ship the raw 4:3 plate mislabelled as a 1200x630 card.
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const crumbs: readonly Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Collections', path: '/collections' },
    { name: product.categoryName, path: `/collections/${product.categorySlug}` },
    { name: product.name, path: `/products/${product.slug}` },
  ];

  const videos = product.media.filter(
    (m): m is Extract<MediaAsset, { kind: 'video' }> => m.kind === 'video',
  );

  return (
    <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8">
      <Breadcrumbs crumbs={crumbs} />

      <VariantProvider variants={product.variants}>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          {/* Media --------------------------------------------------------- */}
          {/* min-w-0: a grid item defaults to `min-width: auto`, which resolves to
              its content's min-content width. Without this the thumbnail rail
              refuses to shrink and pushes the column past the viewport at 360px. */}
          <div className="min-w-0">
            <ProductGallery
              media={product.media}
              dimensions={product.dimensions}
              productName={product.name}
            />
          </div>

          {/* Specification ------------------------------------------------- */}
          <div className="min-w-0">
            <h1 className="text-step-4">{product.name}</h1>
            <p className="mt-1 font-mono text-step--1 uppercase tracking-wide text-ink-muted">
              {product.sku}
            </p>

            <p className="mt-4 max-w-(--measure) text-step-1 text-ink-muted">{product.summary}</p>

            <div className="mt-6">
              <VariantSelector currency={product.currency} />
            </div>

            <div className="mt-6">
              <AddToCart
                productId={product.id}
                basePriceMinor={product.basePriceMinor}
                currency={product.currency}
                leadTimeDays={product.leadTimeDays}
                productStockQty={product.stockQty}
              />
            </div>

            {/* Dimensions as data — the question every furniture buyer has. */}
            <section aria-labelledby="spec" className="mt-8">
              <h2 id="spec" className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
                Specification
              </h2>
              <SpecList className="mt-3">
                {product.dimensions ? (
                  <>
                    <SpecRow label="Width" mono>
                      {formatMm(product.dimensions.w)}
                    </SpecRow>
                    <SpecRow label="Depth" mono>
                      {formatMm(product.dimensions.d)}
                    </SpecRow>
                    <SpecRow label="Height" mono>
                      {formatMm(product.dimensions.h)}
                    </SpecRow>
                    {product.dimensions.seatH !== undefined && (
                      <SpecRow label="Seat height" mono>
                        {formatMm(product.dimensions.seatH)}
                      </SpecRow>
                    )}
                    <SpecRow label="Overall" mono>
                      {formatWdh(product.dimensions)}
                    </SpecRow>
                  </>
                ) : (
                  // Said plainly rather than left blank or filled with a guess.
                  <SpecRow label="Dimensions">
                    Not measured yet — call the showroom and we will measure it for you.
                  </SpecRow>
                )}
                {product.extraSpecs.map((spec) => (
                  <SpecRow key={spec.label} label={spec.label} mono={spec.mono ?? false}>
                    {spec.value}
                  </SpecRow>
                ))}
                <SpecRow label="Materials">{product.materials.join(', ')}</SpecRow>
                <SpecRow label="Lead time" mono>
                  {leadTimeSentence(product.leadTimeDays, product.stockQty)}
                </SpecRow>
                <SpecRow label="Delivery">
                  Delivered to {SHOWROOM.areaServed}. {PAYMENT_LINE}
                </SpecRow>
              </SpecList>
            </section>
          </div>
        </div>
      </VariantProvider>

      {/* Description and care ---------------------------------------------- */}
      <div className="mt-14 grid gap-10 border-t border-rule pt-8 md:grid-cols-2">
        <section aria-labelledby="about">
          <h2 id="about" className="text-step-2">
            About this piece
          </h2>
          <Prose text={product.descriptionMd} className="mt-4" />
        </section>
        <section aria-labelledby="care">
          <h2 id="care" className="text-step-2">
            Materials and care
          </h2>
          <Prose text={product.careMd} className="mt-4" />
        </section>
      </div>

      {/* Related — streamed, because it is not what the page is for. */}
      <Suspense fallback={<RelatedSkeleton />}>
        <Related slug={product.slug} categorySlug={product.categorySlug} categoryName={product.categoryName} />
      </Suspense>

      <JsonLd data={productJsonLd(product, null)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      {/* One VideoObject per video actually rendered — never for a video that is
          not on the page. */}
      {videos.map((video) => (
        <JsonLd key={video.id} data={videoObjectJsonLd(video, product, product.updatedAt)} />
      ))}
    </div>
  );
}

async function Related({
  slug,
  categorySlug,
  categoryName,
}: {
  slug: string;
  categorySlug: string;
  categoryName: string;
}) {
  const related = await getRelated(slug, categorySlug);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related" className="mt-14 border-t border-rule pt-8">
      <h2 id="related" className="text-step-3">
        More in {categoryName.toLowerCase()}
      </h2>
      <div className="mt-6">
        <ProductGrid products={related} />
      </div>
    </section>
  );
}

/** Matches the final layout's dimensions so the stream-in cannot shift the page. */
function RelatedSkeleton() {
  return (
    <section className="mt-14 border-t border-rule pt-8" aria-hidden="true">
      <div className="h-8 w-64 bg-surface-sunken" />
      <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="border-t border-rule pt-4">
            <div className="mb-4 border border-rule bg-surface-sunken" style={{ aspectRatio: '4 / 3' }} />
            <div className="h-6 w-3/4 bg-surface-sunken" />
            <div className="mt-2 h-4 w-1/3 bg-surface-sunken" />
            <div className="mt-3 h-4 w-1/2 bg-surface-sunken" />
          </li>
        ))}
      </ul>
    </section>
  );
}
