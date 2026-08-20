/**
 * The storefront read contract.
 *
 * These are view models, not database rows. Everything the public pages render
 * is shaped here, and exactly one layer (`queries.ts`) is allowed to map a
 * Postgres row onto one of these types. When the schema lands, that mapping is
 * the only thing that changes — no component reaches into a raw row.
 *
 * Money is carried as a `string` of minor units, never a `number`. Formatting
 * happens in <Price> and nowhere else.
 *
 * The columns each type expects are named in the comments; docs/progress.md
 * carries the same list as the handoff to whoever owns the schema.
 */

/** `products.dimensions` jsonb. Millimetres, because that is how furniture is drawn. */
export interface Dimensions {
  /** width, mm */
  w: number;
  /** depth, mm */
  d: number;
  /** height, mm */
  h: number;
  /** seat height, mm — optional, only meaningful for seating */
  seatH?: number;
}

/**
 * `media_assets.anchors` jsonb — the bounding box of the piece inside the frame,
 * as fractions of the image, origin top-left. This is what makes the dimension
 * annotations a drawing derived from data rather than a hand-placed decoration.
 */
export interface MediaAnchors {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type MediaProvider = 'supabase' | 'local' | 'mux' | 'youtube';

interface MediaBase {
  id: string;
  provider: MediaProvider;
  /** `media_assets.provider_ref` — storage path, playback id, or video id. */
  providerRef: string;
  /** `media_assets.alt_text`, NOT NULL in the schema so it cannot be skipped. */
  alt: string;
  width: number;
  height: number;
  /** `media_assets.blur_data_url`, extracted at upload. Zero CLS depends on it. */
  blurDataUrl: string | null;
  position: number;
  /** Null when the asset belongs to the product rather than to one variant. */
  variantId: string | null;
  anchors: MediaAnchors | null;
}

export interface ImageAsset extends MediaBase {
  kind: 'image';
}

export interface VideoAsset extends MediaBase {
  kind: 'video';
  /** `media_assets.poster_path` — required for every video, so the slot is never empty. */
  posterRef: string;
  /** `media_assets.duration_s`. Capped at 20s by the upload UI (ADR-003). */
  durationSeconds: number;
}

export type MediaAsset = ImageAsset | VideoAsset;

/**
 * A finish is chosen from a swatch; a size is chosen from a labelled control.
 * Rendering a seat count as a colour square would be nonsense, so the selector
 * branches on this rather than on a guess about the name.
 */
export type VariantKind = 'finish' | 'size';

export interface Variant {
  id: string;
  kind: VariantKind;
  name: string;
  /** Minor units, as a string. May be negative. */
  priceDeltaMinor: string;
  sku: string | null;
  /** Null means made to order; 0 means unavailable. Never conflate the two. */
  stockQty: number | null;
  /**
   * The finish this variant is made in — rendered as a labelled swatch, never as
   * colour alone. `swatchHex` is decoration; `material` is the accessible name.
   */
  material: string;
  swatchHex: string | null;
}

export interface SpecEntry {
  label: string;
  value: string;
  /** True when the value is a number a person could measure or read aloud. */
  mono?: boolean;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  /** One sentence. Rendered under the category name on /collections. */
  blurb: string;
  updatedAt: string;
  productCount: number;
  cover: ImageAsset | null;
}

/** What a grid card needs, and nothing more. Listings never select `*`. */
export interface ProductCardModel {
  id: string;
  slug: string;
  name: string;
  sku: string;
  /**
   * Minor units as a string, or **null when the price is not settled yet**.
   *
   * Null is not zero and it is not "free": it means the merchant has not given a
   * figure, so the storefront asks the shopper to call rather than inventing one.
   * A null price also drops the `Offer` from the Product JSON-LD entirely — a
   * structured-data offer without a price is worse than no offer at all.
   */
  basePriceMinor: string | null;
  currency: string;
  /** Null means made to order (docs/domain.md §8). */
  stockQty: number | null;
  leadTimeDays: number;
  /**
   * Null when the piece has not been measured yet. The site's promise is that
   * every listing carries its numbers, so null is a gap to be closed rather than
   * a normal state — but it must not block a piece from listing, and it must
   * never be faked. The dimension overlay does not draw without it.
   */
  dimensions: Dimensions | null;
  /**
   * Attributes that are not dimensions but belong in the spec block: cushion
   * grade, warranty, upholstery options. Free-form so a new one is a data change.
   */
  extraSpecs: readonly SpecEntry[];
  categorySlug: string;
  categoryName: string;
  primaryImage: ImageAsset | null;
  materials: readonly string[];
  updatedAt: string;
}

export interface ProductDetailModel extends ProductCardModel {
  /** ≤ 155 chars of plain text. Feeds the meta description and the OG card. */
  summary: string;
  descriptionMd: string;
  careMd: string;
  media: readonly MediaAsset[];
  variants: readonly Variant[];
  /** ISO date. Emitted as `priceValidUntil` on the Offer. */
  priceValidUntil: string;
}

export interface DeliveryZoneSummary {
  id: string;
  name: string;
  feeMinor: string;
}

/* -------------------------------------------------------------------------- */
/* Listing inputs                                                              */
/* -------------------------------------------------------------------------- */

export const SORT_OPTIONS = ['featured', 'price-asc', 'price-desc', 'newest'] as const;
export type Sort = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  featured: 'Featured',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
  newest: 'Newest',
};

/** Price bands in minor units. Named so a URL reads as a sentence. */
export const PRICE_BANDS = [
  { slug: 'under-25k', label: 'Under KSh 25,000', minMinor: null, maxMinor: '2500000' },
  { slug: '25k-60k', label: 'KSh 25,000 – 60,000', minMinor: '2500000', maxMinor: '6000000' },
  { slug: '60k-120k', label: 'KSh 60,000 – 120,000', minMinor: '6000000', maxMinor: '12000000' },
  { slug: 'over-120k', label: 'Over KSh 120,000', minMinor: '12000000', maxMinor: null },
] as const;

export type PriceBandSlug = (typeof PRICE_BANDS)[number]['slug'];

export interface ListingQuery {
  categorySlug: string;
  material: string | null;
  priceBand: PriceBandSlug | null;
  sort: Sort;
  page: number;
}

export interface ListingResult {
  items: readonly ProductCardModel[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
  /** Every material present in this category, for the filter rail. */
  materials: readonly string[];
}

export const PER_PAGE = 12;
