import 'server-only';

import catalogue from './catalogue.json';
import realMedia from './generated-real-media.json';
import { PLATES } from './generated-plates';
import type {
  CategorySummary,
  Dimensions,
  ImageAsset,
  MediaAsset,
  ProductCardModel,
  ProductDetailModel,
  SpecEntry,
  Variant,
} from './types';
import { CURRENCY } from '@/lib/site';

/**
 * The fixture catalogue.
 *
 * The storefront was built before the schema existed, so this module implements
 * the same read contract as `queries.ts` against local data. `source.ts` picks
 * between the two at runtime. Everything here is shaped exactly as a Postgres row
 * would arrive, so swapping the source cannot change what a component receives.
 *
 * This is not seed data for the database — that belongs to whoever owns
 * `supabase/seed.sql`. It exists so the storefront can be rendered, screenshotted,
 * profiled and audited without a database.
 */

type RawPiece = (typeof catalogue.pieces)[number];
type RawVariant = RawPiece['variants'][number];

function plate(key: string) {
  const found = PLATES[key];
  if (!found) throw new Error(`Missing generated plate: ${key}`);
  return found;
}

/**
 * Alt text describes the image for someone who cannot see it. These plates are
 * elevation drawings, so that is what the alt text says — describing them as
 * photographs would be a lie told to a screen reader.
 */
function plateAlt(piece: RawPiece, finish?: string): string {
  const base = `Front elevation drawing of the ${piece.name}, ${piece.w} by ${piece.h} millimetres`;
  return finish ? `${base}, shown in ${finish.toLowerCase()}` : `${base}`;
}

function variantId(slug: string, index: number): string {
  return `${slug}:v${index}`;
}

function toVariant(slug: string, raw: RawVariant, index: number): Variant {
  return {
    id: variantId(slug, index),
    name: raw.name,
    priceDeltaMinor: raw.priceDeltaMinor,
    sku: raw.sku,
    stockQty: raw.stockQty,
    kind: 'finish',
    material: raw.material,
    swatchHex: raw.swatchHex,
  };
}

function productMedia(piece: RawPiece): MediaAsset[] {
  const out: MediaAsset[] = [];
  let position = 0;

  for (const ratio of ['wide', 'square', 'pano'] as const) {
    const p = plate(`${piece.slug}:${ratio}`);
    out.push({
      kind: 'image',
      id: `${piece.slug}:${ratio}`,
      provider: 'local',
      providerRef: p.path,
      alt: plateAlt(piece),
      width: p.width,
      height: p.height,
      blurDataUrl: p.blurDataUrl,
      position: position++,
      variantId: null,
      anchors: p.anchors,
    });
  }

  for (const [i, variant] of piece.variants.entries()) {
    for (const ratio of ['wide', 'square'] as const) {
      const p = plate(`${piece.slug}:v${i}:${ratio}`);
      out.push({
        kind: 'image',
        id: `${piece.slug}:v${i}:${ratio}`,
        provider: 'local',
        providerRef: p.path,
        alt: plateAlt(piece, variant.name),
        width: p.width,
        height: p.height,
        blurDataUrl: p.blurDataUrl,
        position: position++,
        variantId: variantId(piece.slug, i),
        anchors: p.anchors,
      });
    }
  }

  return out;
}

function primaryImage(piece: RawPiece): ImageAsset {
  const p = plate(`${piece.slug}:wide`);
  return {
    kind: 'image',
    id: `${piece.slug}:wide`,
    provider: 'local',
    providerRef: p.path,
    alt: plateAlt(piece),
    width: p.width,
    height: p.height,
    blurDataUrl: p.blurDataUrl,
    position: 0,
    variantId: null,
    anchors: p.anchors,
  };
}

function dimensions(piece: RawPiece): Dimensions {
  const seatH = 'seatH' in piece ? (piece as { seatH?: number }).seatH : undefined;
  return seatH === undefined
    ? { w: piece.w, d: piece.d, h: piece.h }
    : { w: piece.w, d: piece.d, h: piece.h, seatH };
}

function materials(piece: RawPiece): string[] {
  return [...new Set(piece.variants.map((v) => v.material))];
}

function categoryName(slug: string): string {
  const found = catalogue.categories.find((c) => c.slug === slug);
  return found ? found.name : slug;
}

/** A year from the last edit. Deterministic, so a rebuild does not churn the markup. */
function priceValidUntil(updatedAt: string): string {
  const d = new Date(updatedAt);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

function toCard(piece: RawPiece): ProductCardModel {
  return {
    id: piece.slug,
    slug: piece.slug,
    name: piece.name,
    sku: piece.sku,
    basePriceMinor: piece.basePriceMinor,
    currency: CURRENCY,
    stockQty: piece.stockQty,
    leadTimeDays: piece.leadTimeDays,
    dimensions: dimensions(piece),
    extraSpecs: [],
    categorySlug: piece.category,
    categoryName: categoryName(piece.category),
    primaryImage: primaryImage(piece),
    materials: materials(piece),
    updatedAt: piece.updatedAt,
  };
}

function toDetail(piece: RawPiece): ProductDetailModel {
  return {
    ...toCard(piece),
    summary: piece.summary,
    descriptionMd: piece.descriptionMd,
    careMd: piece.careMd,
    media: productMedia(piece),
    variants: piece.variants.map((v, i) => toVariant(piece.slug, v, i)),
    priceValidUntil: priceValidUntil(piece.updatedAt),
  };
}


/* -------------------------------------------------------------------------- */
/* Real merchant pieces                                                        */
/*                                                                             */
/* Photography and video supplied by the merchant and ingested by              */
/* scripts/ingest-media.mjs. These carry no dimensions yet — the pieces have    */
/* not been measured, and the site states that plainly rather than inventing a  */
/* number. A piece with no price is staged unpublished rather than listed at    */
/* zero.                                                                        */
/* -------------------------------------------------------------------------- */

type RealPiece = (typeof catalogue.realPieces)[number];

interface PlateEntry {
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
}

interface VideoEntry {
  path: string;
  posterPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  blurDataUrl: string;
}

const REAL_MEDIA = realMedia as Record<string, unknown>;

function realImage(asset: string, shape: string): PlateEntry {
  const group = REAL_MEDIA[asset] as Record<string, PlateEntry> | undefined;
  const entry = group?.[shape];
  if (!entry) throw new Error(`Missing ingested image ${asset}:${shape}`);
  return entry;
}

function realVideo(asset: string): VideoEntry {
  const entry = REAL_MEDIA[asset] as VideoEntry | undefined;
  if (!entry?.path) throw new Error(`Missing ingested video ${asset}`);
  return entry;
}

function realPieceMedia(piece: RealPiece): MediaAsset[] {
  return piece.media.map((m, position) => {
    const spec = m as { asset: string; shape?: string; kind?: string; alt: string };

    if (spec.kind === 'video') {
      const v = realVideo(spec.asset);
      return {
        kind: 'video',
        id: `${piece.slug}:v${position}`,
        provider: 'local',
        providerRef: v.path,
        posterRef: v.posterPath,
        durationSeconds: v.durationSeconds,
        alt: spec.alt,
        width: v.width,
        height: v.height,
        blurDataUrl: v.blurDataUrl,
        position,
        variantId: null,
        // No measured anchor box: these are photographs, not elevations, so the
        // dimension overlay has nothing to draw against.
        anchors: null,
      } satisfies MediaAsset;
    }

    const img = realImage(spec.asset, spec.shape ?? 'wide');
    return {
      kind: 'image',
      id: `${piece.slug}:i${position}`,
      provider: 'local',
      providerRef: img.path,
      alt: spec.alt,
      width: img.width,
      height: img.height,
      blurDataUrl: img.blurDataUrl,
      position,
      variantId: null,
      anchors: null,
    } satisfies MediaAsset;
  });
}

function realToCard(piece: RealPiece): ProductCardModel {
  const media = realPieceMedia(piece);
  const firstImage = media.find((m): m is ImageAsset => m.kind === 'image') ?? null;

  return {
    id: piece.slug,
    slug: piece.slug,
    name: piece.name,
    sku: piece.sku,
    basePriceMinor: piece.basePriceMinor,
    currency: CURRENCY,
    stockQty: piece.stockQty,
    leadTimeDays: piece.leadTimeDays,
    dimensions: null,
    extraSpecs: piece.extraSpecs as readonly SpecEntry[],
    categorySlug: piece.category,
    categoryName: categoryName(piece.category),
    primaryImage: firstImage,
    materials: piece.materials,
    updatedAt: piece.updatedAt,
  };
}

function realToDetail(piece: RealPiece): ProductDetailModel {
  return {
    ...realToCard(piece),
    summary: piece.summary,
    descriptionMd: piece.descriptionMd,
    careMd: piece.careMd,
    media: realPieceMedia(piece),
    variants: piece.variants.map((v, i) => ({
      id: `${piece.slug}:v${i}`,
      kind: v.kind === 'size' ? ('size' as const) : ('finish' as const),
      name: v.name,
      priceDeltaMinor: v.priceDeltaMinor,
      sku: v.sku,
      stockQty: v.stockQty,
      material: v.material,
      swatchHex: v.swatchHex,
    })),
    priceValidUntil: priceValidUntil(piece.updatedAt),
  };
}

/** Unpublished pieces are staged, not listed. anon RLS would refuse them anyway. */
const PUBLISHED_REAL = catalogue.realPieces.filter((p) => p.published);

/**
 * The plate-backed pieces have invented names, copy and prices. They existed so
 * the storefront could be built, profiled and audited before real stock arrived,
 * and they must never reach a live site — a real business cannot ship fabricated
 * prices next to its own.
 *
 * `NEXT_PUBLIC_INCLUDE_SAMPLE_CATALOGUE=false` drops them entirely, leaving only
 * merchant-supplied pieces. Anything other than the literal string "true" is
 * treated as false, so the safe state is the default: forgetting to set it
 * excludes the samples rather than publishing them.
 */
const INCLUDE_SAMPLES = process.env.NEXT_PUBLIC_INCLUDE_SAMPLE_CATALOGUE === 'true';

const SAMPLE_PIECES: readonly RawPiece[] = INCLUDE_SAMPLES ? catalogue.pieces : [];

export const FIXTURE_PRODUCTS: readonly ProductDetailModel[] = [
  ...PUBLISHED_REAL.map(realToDetail),
  ...SAMPLE_PIECES.map(toDetail),
];

export const FIXTURE_CARDS: readonly ProductCardModel[] = [
  ...PUBLISHED_REAL.map(realToCard),
  ...SAMPLE_PIECES.map(toCard),
];

export const FIXTURE_FEATURED: readonly ProductCardModel[] = [
  ...PUBLISHED_REAL.filter((p) => p.featured).map(realToCard),
  ...SAMPLE_PIECES.filter((p) => p.featured).map(toCard),
];

export const FIXTURE_CATEGORIES: readonly CategorySummary[] = catalogue.categories.map((c) => {
  const plateInCategory = SAMPLE_PIECES.filter((p) => p.category === c.slug);
  const realInCategory = PUBLISHED_REAL.filter((p) => p.category === c.slug);
  const first = plateInCategory[0];
  const realCover = realInCategory[0] ? realToCard(realInCategory[0]).primaryImage : null;
  return {
    id: c.slug,
    slug: c.slug,
    name: c.name,
    blurb: c.blurb,
    updatedAt: c.updatedAt,
    productCount: plateInCategory.length + realInCategory.length,
    // Real photography leads the category card where there is any.
    cover: realCover ?? (first ? primaryImage(first) : null),
  };
});
