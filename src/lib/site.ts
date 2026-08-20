/**
 * Merchant identity — one file, because it is emitted in three places that must
 * agree byte for byte: the visible footer, the `FurnitureStore` JSON-LD, and the
 * Google Business Profile.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NAME, ADDRESS and PHONE are confirmed by the merchant. Still outstanding:
 * EMAIL, the geo coordinates, and the opening hours — all marked below.
 *
 * Whatever lands here must match the Google Business Profile byte for byte.
 * Inconsistent NAP is the main local-ranking killer for a single-showroom
 * retailer, and these values are emitted into FurnitureStore JSON-LD.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MERCHANT = 'Furniture Version';

export const SITE_DESCRIPTION =
  'Hardwood furniture made to order in Nairobi. Every piece is listed with its ' +
  'dimensions, materials and lead time, and you pay when it arrives.';

/**
 * An environment variable that exists but is empty is the same as missing.
 *
 * `??` does not catch this: a Vercel project variable added without a value
 * arrives as `''`, which is a string, so `??` passes it straight through. That
 * turned `new URL('')` into a build failure. Everything read from the
 * environment goes through here.
 */
function env(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export const CURRENCY = env('NEXT_PUBLIC_CURRENCY') ?? 'KES';
export const LOCALE = 'en-KE';
export const OG_LOCALE = 'en_KE';

/**
 * The origin every canonical, sitemap entry and OG image URL is built from.
 *
 * Order of preference:
 *   1. NEXT_PUBLIC_SITE_URL — the real domain, once there is one.
 *   2. The Vercel production domain, so a deploy without step 1 still produces
 *      working absolute URLs instead of failing the build or emitting localhost.
 *   3. localhost, for development.
 *
 * This must never throw. A malformed value degrades to the next option rather
 * than taking the whole build down, because an unusable canonical is a bad day
 * and a failed build is a worse one.
 */
export function siteUrl(): string {
  const candidates = [
    env('NEXT_PUBLIC_SITE_URL'),
    // Vercel supplies these without a protocol.
    withProtocol(env('NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL')),
    withProtocol(env('VERCEL_PROJECT_PRODUCTION_URL')),
    withProtocol(env('NEXT_PUBLIC_VERCEL_URL')),
    withProtocol(env('VERCEL_URL')),
    'http://localhost:3000',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      return url.origin;
    } catch {
      // Not a usable URL — try the next candidate.
    }
  }

  return 'http://localhost:3000';
}

function withProtocol(host: string | null): string | null {
  if (!host) return null;
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

/** Placeholder until the Google Business Profile is confirmed. */
export const SHOWROOM = {
  streetAddress: 'Diamond Plaza, Parklands',
  addressLocality: 'Nairobi',
  addressRegion: 'Nairobi County',
  postalCode: '00100',
  addressCountry: 'KE',
  telephone: '+254719286328',
  telephoneDisplay: '+254 719 286 328',
  // Null until the merchant supplies a real address. Every surface that would
  // show an email checks for null, so there is no placeholder to leak.
  email: null as string | null,
  // Approximate, from the Diamond Plaza landmark. Confirm against the Google
  // Business Profile pin before launch: a wrong pin sends customers to the wrong
  // door, which is worse than no pin at all.
  latitude: -1.26261,
  longitude: 36.82028,
  areaServed: 'Nairobi and upcountry Kenya',
} as const;

/**
 * `openingHoursSpecification` in the shape schema.org expects. Times are 24h.
 */
export const OPENING_HOURS = [
  { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
  { days: ['Saturday'], opens: '09:00', closes: '16:00' },
] as const;

/** Social profiles for `sameAs`. Empty until the merchant confirms the handles. */
export const SAME_AS: readonly string[] = [];

export const NAV_LINKS = [
  { href: '/collections', label: 'Collections' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/showroom', label: 'Showroom' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * The piece the home page leads with. Named explicitly rather than taken from the
 * first featured product, so changing the hero is one edit and does not depend on
 * the order of the catalogue.
 *
 * Pick something photographed well: the hero image is the LCP element and the
 * first impression of the whole workshop.
 */
export const HERO_SLUG = 'solid-dining-table';

/**
 * Cash on delivery, stated the way a customer would say it. This exact sentence
 * appears next to the action on the product page and in the footer.
 */
export const PAYMENT_LINE = 'Pay cash when it arrives.';
