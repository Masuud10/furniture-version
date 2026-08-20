import type { Metadata } from 'next';
import Link from 'next/link';

import { DimensionFigure } from '@/components/storefront/dimension-figure';
import { ProductGrid } from '@/components/storefront/product-grid';
import { ButtonLink } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { getCategories, getFeatured, getProduct } from '@/lib/catalog/source';
import { HERO_SLUG, MERCHANT, PAYMENT_LINE, SHOWROOM } from '@/lib/site';

export const metadata: Metadata = {
  // The root template appends the merchant name, so this must not repeat it.
  title: { absolute: `${MERCHANT} — Handmade furniture in Nairobi` },
  description:
    'Hardwood furniture made to order in Nairobi. Every piece is listed with its dimensions, materials and lead time. Pay cash when it arrives.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: `${MERCHANT} — Handmade furniture in Nairobi`,
    description:
      'Hardwood furniture made to order in Nairobi, listed with full dimensions and lead times.',
  },
};

export default async function HomePage() {
  const [featured, categories, heroProduct] = await Promise.all([
    getFeatured(),
    getCategories(),
    getProduct(HERO_SLUG),
  ]);
  // Fall back to the first featured piece if the named hero is ever unpublished,
  // so the home page cannot lose its opening image because of a catalogue edit.
  const hero = heroProduct ?? featured[0];

  return (
    <>
      {/* Hero — a drawing sheet, not a lifestyle photograph. The thesis is that
          this shop tells you the numbers before you ask. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-8 md:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12">
            {hero?.primaryImage && (
              <DimensionFigure
                dimensions={hero.dimensions}
                anchors={hero.primaryImage.anchors}
                axes="wdh"
                className="order-2 border border-rule lg:order-1"
              >
                <Media
                  asset={hero.primaryImage}
                  sizes="(min-width: 64rem) 56vw, 94vw"
                  priority
                  quality={90}
                />
              </DimensionFigure>
            )}

            <div className="order-1 lg:order-2">
              <p className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
                Made to order in Nairobi
              </p>
              <h1 className="mt-3 text-step-6">Every piece, with its numbers on it.</h1>
              <p className="mt-4 max-w-(--measure) text-step-1 text-ink-muted">
                Furniture is a measuring problem before it is a taste problem. So every
                listing here carries its width, depth and height, the timber it is cut
                from, and how long it takes to build — before you have to ask.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <ButtonLink href="/collections" size="lg">
                  Browse collections
                </ButtonLink>
                <p className="font-mono text-step--1 text-ink-muted">{PAYMENT_LINE}</p>
              </div>

              {hero && (
                <p className="mt-6 border-t border-rule pt-4 font-mono text-step--1 text-ink-muted">
                  Above:{' '}
                  <Link href={`/products/${hero.slug}`} className="text-ink underline-offset-4 hover:underline">
                    {hero.name}
                  </Link>
                  {' · '}
                  {hero.basePriceMinor === null ? (
                    <span className="text-accent">Ask price</span>
                  ) : (
                    <Price minor={hero.basePriceMinor} currency={hero.currency} />
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories ---------------------------------------------------------- */}
      <section aria-labelledby="home-collections" className="border-b border-rule">
        <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-10 md:py-14">
          <h2 id="home-collections" className="text-step-3">
            Collections
          </h2>
          <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.slug} className="border-t border-rule pt-4">
                {category.cover && (
                  <Link href={`/collections/${category.slug}`} tabIndex={-1} aria-hidden="true">
                    <Media
                      asset={category.cover}
                      sizes="(min-width: 64rem) 23vw, (min-width: 40rem) 47vw, 92vw"
                      className="mb-4 border border-rule"
                    />
                  </Link>
                )}
                <h3 className="text-step-1">
                  <Link
                    href={`/collections/${category.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {category.name}
                  </Link>
                </h3>
                <p className="mt-2 text-step--1 text-ink-muted">{category.blurb}</p>
                <p className="mt-2 font-mono text-step--1 tabular-nums text-ink-muted">
                  {category.productCount} pieces
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured ------------------------------------------------------------ */}
      {featured.length > 0 && (
        <section aria-labelledby="home-featured" className="border-b border-rule">
          <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-10 md:py-14">
            <h2 id="home-featured" className="text-step-3">
              A few pieces
            </h2>
            <div className="mt-6">
              <ProductGrid products={featured.slice(0, 4)} />
            </div>
          </div>
        </section>
      )}

      {/* How it is made ------------------------------------------------------ */}
      <section aria-labelledby="home-making" className="border-b border-rule">
        <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-10 md:py-14">
          <h2 id="home-making" className="text-step-3">
            How it is made
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <article className="border-t border-rule pt-4">
              <h3 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
                01 — Timber
              </h3>
              <p className="mt-3 text-step-0">
                Kiln-dried hardwood, cut and matched by hand. Solid tops rather than
                veneered board, because a scratch in a solid top sands out and a scratch
                through a veneer does not.
              </p>
            </article>
            <article className="border-t border-rule pt-4">
              <h3 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
                02 — Joinery
              </h3>
              <p className="mt-3 text-step-0">
                Mortise and tenon at the corners, glued and pinned. Beds and wardrobes are
                bolted instead, so they come apart when you move house rather than staying
                behind.
              </p>
            </article>
            <article className="border-t border-rule pt-4">
              <h3 className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
                03 — Finish
              </h3>
              <p className="mt-3 text-step-0">
                Hardwax oil, applied by hand. You can repair it in place with a cloth and
                a tin, which is the difference between furniture that ages and furniture
                that wears out.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Showroom ------------------------------------------------------------ */}
      <section aria-labelledby="home-showroom">
        <div className="mx-auto max-w-(--page-max) px-(--page-gutter) py-10 md:py-14">
          <div className="grid gap-6 border-t border-rule pt-6 md:grid-cols-2">
            <div>
              <h2 id="home-showroom" className="text-step-3">
                Sit on it first
              </h2>
              <p className="mt-3 max-w-(--measure) text-step-0 text-ink-muted">
                Most of the catalogue is on the floor at the showroom on{' '}
                {SHOWROOM.streetAddress}. Come and measure it yourself — bring the
                dimensions of your room and we will tell you honestly whether it fits.
              </p>
            </div>
            <div className="flex items-end md:justify-end">
              <ButtonLink href="/showroom" variant="secondary" size="lg">
                Showroom and opening hours
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
