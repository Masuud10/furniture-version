import { toMajorInput } from '@/lib/money';
import { isoDuration, mediaUrl, posterUrl } from '@/lib/catalog/media-url';
import type { MediaAsset, ProductDetailModel, Variant } from '@/lib/catalog/types';
import { MERCHANT, OPENING_HOURS, SAME_AS, SHOWROOM, SITE_DESCRIPTION } from '@/lib/site';
import { absoluteUrl } from './urls';

/**
 * Structured data builders. Typed objects only — no string concatenation, and no
 * `aggregateRating` or `review` anywhere, because there are no reviews in the
 * database. Fabricated review markup is a manual-action risk and it is the single
 * most common way a small store gets penalised.
 */

type Json = Record<string, unknown>;

function absoluteMediaUrl(asset: MediaAsset): string {
  const url = mediaUrl(asset);
  return url.startsWith('http') ? url : absoluteUrl(url);
}

export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': absoluteUrl('/#organization'),
    name: MERCHANT,
    url: absoluteUrl('/'),
    description: SITE_DESCRIPTION,
    telephone: SHOWROOM.telephone,
    ...(SHOWROOM.email ? { email: SHOWROOM.email } : {}),
    logo: absoluteUrl('/logo.svg'),
    ...(SAME_AS.length > 0 ? { sameAs: [...SAME_AS] } : {}),
  };
}

/**
 * `FurnitureStore` is a real schema.org subtype of `LocalBusiness`. Name, address
 * and telephone must stay byte-identical to the Google Business Profile — see the
 * warning at the top of src/lib/site.ts.
 */
export function furnitureStoreJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FurnitureStore',
    '@id': absoluteUrl('/showroom#store'),
    name: MERCHANT,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/showroom'),
    telephone: SHOWROOM.telephone,
    ...(SHOWROOM.email ? { email: SHOWROOM.email } : {}),
    image: absoluteUrl('/opengraph-image'),
    logo: absoluteUrl('/logo.svg'),
    priceRange: 'KSh 19,500 – KSh 165,000',
    currenciesAccepted: 'KES',
    paymentAccepted: 'Cash on delivery',
    address: {
      '@type': 'PostalAddress',
      streetAddress: SHOWROOM.streetAddress,
      addressLocality: SHOWROOM.addressLocality,
      addressRegion: SHOWROOM.addressRegion,
      postalCode: SHOWROOM.postalCode,
      addressCountry: SHOWROOM.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SHOWROOM.latitude,
      longitude: SHOWROOM.longitude,
    },
    areaServed: SHOWROOM.areaServed,
    openingHoursSpecification: OPENING_HOURS.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.days.map((d) => `https://schema.org/${d}`),
      opens: slot.opens,
      closes: slot.closes,
    })),
    ...(SAME_AS.length > 0 ? { sameAs: [...SAME_AS] } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** Must match the visible breadcrumb exactly. Both are built from the same array. */
export function breadcrumbJsonLd(crumbs: readonly Crumb[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

function availability(stockQty: number | null): string {
  // Null means made to order, which is PreOrder — never OutOfStock. Conflating
  // the two would hide most of this catalogue from search. See docs/domain.md §8.
  if (stockQty === null) return 'https://schema.org/PreOrder';
  return stockQty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

/**
 * `Product` with a nested `Offer`. Price is a decimal string built from integer
 * minor units — never a float, and never `String(number / 100)`.
 */
export function productJsonLd(product: ProductDetailModel, variant: Variant | null): Json {
  const images = product.media
    .filter((m): m is Extract<MediaAsset, { kind: 'image' }> => m.kind === 'image')
    .filter((m) => m.variantId === null)
    .map(absoluteMediaUrl);

  const stock = variant ? variant.stockQty : product.stockQty;

  // A piece with no settled price gets no Offer. Emitting an offer with a zero or
  // omitted price is a structured-data error and would misrepresent the listing.
  const offers =
    product.basePriceMinor === null
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price: toMajorInput(
              BigInt(product.basePriceMinor) + BigInt(variant?.priceDeltaMinor ?? '0'),
            ),
            priceCurrency: product.currency,
            availability: availability(stock),
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: product.priceValidUntil,
            url: absoluteUrl(`/products/${product.slug}`),
            seller: { '@type': 'Organization', name: MERCHANT },
          },
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary,
    sku: variant?.sku ?? product.sku,
    image: images,
    brand: { '@type': 'Brand', name: MERCHANT },
    material: [...product.materials],
    ...(variant ? { color: variant.name } : {}),
    // Omitted entirely when the piece has not been measured. A zero or a guess
    // here would be a fabricated specification in structured data.
    ...(product.dimensions
      ? {
          width: { '@type': 'QuantitativeValue', value: product.dimensions.w / 10, unitCode: 'CMT' },
          depth: { '@type': 'QuantitativeValue', value: product.dimensions.d / 10, unitCode: 'CMT' },
          height: { '@type': 'QuantitativeValue', value: product.dimensions.h / 10, unitCode: 'CMT' },
        }
      : {}),
    ...offers,
  };
}

/**
 * One `VideoObject` per video actually rendered on the page. Callers pass only
 * the assets they render — markup for a video that is not on the page is a
 * warning at best and a penalty at worst.
 */
export function videoObjectJsonLd(
  asset: Extract<MediaAsset, { kind: 'video' }>,
  product: ProductDetailModel,
  uploadDate: string,
): Json {
  const poster = posterUrl(asset);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${product.name} — ${asset.alt}`,
    description: asset.alt,
    thumbnailUrl: [poster.startsWith('http') ? poster : absoluteUrl(poster)],
    uploadDate,
    duration: isoDuration(asset.durationSeconds),
    contentUrl: absoluteMediaUrl(asset),
    embedUrl: absoluteUrl(`/products/${product.slug}`),
  };
}
