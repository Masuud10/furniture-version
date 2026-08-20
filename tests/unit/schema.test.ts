import { describe, expect, it } from 'vitest';

import { availabilityLabel, formatWdh, leadTimeSentence } from '@/lib/catalog/dimensions';
import type { MediaAsset, ProductDetailModel, Variant } from '@/lib/catalog/types';
import { breadcrumbJsonLd, productJsonLd, videoObjectJsonLd } from '@/lib/seo/schema';

const variant: Variant = {
  id: 'p:v1',
  kind: 'finish',
  name: 'Tan leather',
  priceDeltaMinor: '4200000',
  sku: 'KPT-3S-LEA',
  stockQty: null,
  material: 'Leather',
  swatchHex: '#A9764B',
};

const image: MediaAsset = {
  kind: 'image',
  id: 'img-1',
  provider: 'local',
  providerRef: '/media/test-wide.webp',
  alt: 'Front elevation drawing',
  width: 1600,
  height: 1200,
  blurDataUrl: null,
  position: 0,
  variantId: null,
  anchors: null,
};

const product: ProductDetailModel = {
  id: 'p',
  slug: 'kaputei-three-seat-sofa',
  name: 'Kaputei three-seat sofa',
  sku: 'KPT-3S-CAN',
  basePriceMinor: '14500000',
  currency: 'KES',
  stockQty: null,
  leadTimeDays: 28,
  dimensions: { w: 2100, d: 900, h: 780, seatH: 430 },
  extraSpecs: [],
  categorySlug: 'seating',
  categoryName: 'Sofas and chairs',
  primaryImage: image,
  materials: ['Canvas', 'Wool', 'Leather'],
  updatedAt: '2026-08-18T11:20:00.000Z',
  summary: 'A three-seat sofa on a kiln-dried mahogany frame.',
  descriptionMd: 'Body copy.',
  careMd: 'Care copy.',
  media: [image],
  variants: [variant],
  priceValidUntil: '2027-08-18',
};

describe('productJsonLd', () => {
  it('emits price as an exact decimal string built from integer minor units', () => {
    const offers = productJsonLd(product, null)['offers'] as Record<string, unknown>;
    expect(offers['price']).toBe('145000.00');
    expect(typeof offers['price']).toBe('string');
  });

  it('adds the variant delta without ever touching a float', () => {
    const offers = productJsonLd(product, variant)['offers'] as Record<string, unknown>;
    // 14_500_000 + 4_200_000 minor = 187000.00 major
    expect(offers['price']).toBe('187000.00');
  });

  it('maps a null stock quantity to PreOrder, never OutOfStock', () => {
    // docs/domain.md §8: null means made to order. Conflating it with zero would
    // hide most of this catalogue from search.
    const offers = productJsonLd(product, null)['offers'] as Record<string, unknown>;
    expect(offers['availability']).toBe('https://schema.org/PreOrder');
  });

  it('maps zero stock to OutOfStock and positive stock to InStock', () => {
    const out = productJsonLd({ ...product, stockQty: 0 }, null)['offers'] as Record<string, unknown>;
    expect(out['availability']).toBe('https://schema.org/OutOfStock');

    const inStock = productJsonLd({ ...product, stockQty: 4 }, null)['offers'] as Record<string, unknown>;
    expect(inStock['availability']).toBe('https://schema.org/InStock');
  });

  it('converts millimetres to centimetres for schema.org, which wants CMT', () => {
    const json = productJsonLd(product, null);
    expect(json['width']).toEqual({ '@type': 'QuantitativeValue', value: 210, unitCode: 'CMT' });
    expect(json['height']).toEqual({ '@type': 'QuantitativeValue', value: 78, unitCode: 'CMT' });
  });

  it('omits width/depth/height entirely when the piece has not been measured', () => {
    // A zero or a guess here would be a fabricated specification in structured data.
    const json = productJsonLd({ ...product, dimensions: null }, null);
    expect(json).not.toHaveProperty('width');
    expect(json).not.toHaveProperty('depth');
    expect(json).not.toHaveProperty('height');
    // The offer still stands.
    expect((json['offers'] as Record<string, unknown>)['price']).toBe('145000.00');
  });

  it('never emits aggregateRating or review — there are no reviews in the database', () => {
    const json = productJsonLd(product, variant);
    expect(json).not.toHaveProperty('aggregateRating');
    expect(json).not.toHaveProperty('review');
  });

  it('uses the variant SKU when a variant is selected', () => {
    expect(productJsonLd(product, variant)['sku']).toBe('KPT-3S-LEA');
    expect(productJsonLd(product, null)['sku']).toBe('KPT-3S-CAN');
  });

  it('emits absolute image URLs only', () => {
    const images = productJsonLd(product, null)['image'] as string[];
    expect(images.length).toBeGreaterThan(0);
    for (const url of images) expect(url.startsWith('http')).toBe(true);
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and makes every item absolute', () => {
    const json = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Collections', path: '/collections' },
    ]);
    const items = json['itemListElement'] as Array<Record<string, unknown>>;
    expect(items[0]?.['position']).toBe(1);
    expect(items[1]?.['position']).toBe(2);
    expect(String(items[1]?.['item']).startsWith('http')).toBe(true);
  });
});

describe('videoObjectJsonLd', () => {
  it('emits an ISO 8601 duration and an absolute contentUrl', () => {
    const video: MediaAsset = {
      kind: 'video',
      id: 'vid-1',
      provider: 'local',
      providerRef: '/media/test.mp4',
      posterRef: '/media/test-poster.webp',
      durationSeconds: 18,
      alt: 'Slow pan across the sofa',
      width: 1920,
      height: 1080,
      blurDataUrl: null,
      position: 1,
      variantId: null,
      anchors: null,
    };

    const json = videoObjectJsonLd(video, product, '2026-08-18T11:20:00.000Z');
    expect(json['duration']).toBe('PT18S');
    expect(String(json['contentUrl']).startsWith('http')).toBe(true);
    expect((json['thumbnailUrl'] as string[])[0]?.startsWith('http')).toBe(true);
    expect(json['uploadDate']).toBe('2026-08-18T11:20:00.000Z');
  });
});

describe('lead time and availability copy', () => {
  it('states made-to-order plainly rather than as a badge', () => {
    expect(leadTimeSentence(28, null)).toBe('Made to order — ready in 28 days.');
  });

  it('distinguishes in stock from unavailable', () => {
    expect(leadTimeSentence(14, 3)).toBe('In stock — delivered in 14 days.');
    expect(leadTimeSentence(14, 0)).toBe('Not available to order at the moment.');
  });

  it('never reports null stock as unavailable', () => {
    expect(availabilityLabel(null)).toBe('made-to-order');
    expect(availabilityLabel(0)).toBe('unavailable');
    expect(availabilityLabel(2)).toBe('in-stock');
  });
});

describe('formatWdh', () => {
  it('renders the string a buyer reads down the phone', () => {
    expect(formatWdh({ w: 2100, d: 900, h: 780 })).toBe('2100 × 900 × 780 mm');
  });
});
