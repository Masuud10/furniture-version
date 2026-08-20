import { ImageResponse } from 'next/og';

import { formatWdh } from '@/lib/catalog/dimensions';
import { getAllProductSlugs, getProduct } from '@/lib/catalog/source';
import { formatMoney } from '@/lib/money';
import { OG_COLOURS, OG_CONTENT_TYPE, OG_SIZE, OgFrame, ogFonts } from '@/lib/seo/og';
import { MERCHANT } from '@/lib/site';

export const alt = 'Product card';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Prerendered for every published product, so a crawler asking for the card is
 * served a file rather than triggering a render. Regenerating this on every crawl
 * would be wasted compute for an image that changes when the price changes.
 */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, fonts] = await Promise.all([getProduct(slug), ogFonts()]);

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: OG_COLOURS.paper,
            fontFamily: 'InterTight',
            fontSize: 56,
            color: OG_COLOURS.ink,
          }}
        >
          {MERCHANT}
        </div>
      ),
      { ...size, fonts },
    );
  }

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: 'JetBrainsMono',
              fontSize: 24,
              letterSpacing: 2,
              color: OG_COLOURS.inkMuted,
            }}
          >
            {`${product.sku} · ${product.categoryName}`}
          </div>
          <div
            style={{
              fontSize: product.name.length > 26 ? 64 : 78,
              color: OG_COLOURS.ink,
              lineHeight: 1.05,
              marginTop: 18,
              maxWidth: 1000,
            }}
          >
            {product.name}
          </div>
          {product.dimensions && (
            <div
              style={{
                fontFamily: 'JetBrainsMono',
                fontSize: 30,
                color: OG_COLOURS.inkMuted,
                marginTop: 22,
              }}
            >
              {formatWdh(product.dimensions)}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `2px solid ${OG_COLOURS.ink}`,
            paddingTop: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'JetBrainsMono', fontSize: 22, color: OG_COLOURS.inkMuted }}>
              {MERCHANT}
            </div>
            <div style={{ fontFamily: 'JetBrainsMono', fontSize: 22, color: OG_COLOURS.inkMuted }}>
              {product.stockQty === null
                ? `Made to order — ${product.leadTimeDays} days`
                : product.stockQty > 0
                  ? 'In stock'
                  : 'Unavailable'}
            </div>
          </div>
          <div style={{ fontFamily: 'JetBrainsMono', fontSize: 46, color: OG_COLOURS.accent }}>
            {product.basePriceMinor === null
              ? 'Ask price'
              : formatMoney(product.basePriceMinor, { currency: product.currency }).replace(
                  /Ksh/,
                  'KSh',
                )}
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
