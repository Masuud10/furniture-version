import 'server-only';

import { catalogueClient } from './client';
import {
  PER_PAGE,
  PRICE_BANDS,
  type CategorySummary,
  type Dimensions,
  type ListingQuery,
  type ListingResult,
  type MediaAnchors,
  type MediaAsset,
  type ProductCardModel,
  type ProductDetailModel,
  type SpecEntry,
  type Variant,
} from './types';
import { CURRENCY } from '@/lib/site';

/**
 * The only module allowed to turn a Postgres row into a view model.
 *
 * Every select names its columns. `select('*')` on a listing ships the full
 * description of twelve products to render twelve cards.
 *
 * NOTE: these queries are written against the schema described in docs/domain.md
 * and docs/security.md but have not been run against a live database — the schema
 * is owned by another workstream and did not exist when this was written. The
 * column list below is the contract; see docs/progress.md.
 */

/* -------------------------------------------------------------------------- */
/* Column lists — one place, so a schema change is one edit                    */
/* -------------------------------------------------------------------------- */

const MEDIA_COLUMNS =
  'id, provider, provider_ref, kind, alt_text, width, height, blur_data_url, poster_path, duration_s, position, variant_id, anchors';

const VARIANT_COLUMNS = 'id, kind, name, price_delta_minor, sku, stock_qty, material, swatch_hex';

const CARD_COLUMNS = `
  id, slug, name, sku, base_price_minor, currency, stock_qty, lead_time_days,
  dimensions, extra_specs, materials, updated_at,
  categories!inner ( slug, name ),
  media_assets ( ${MEDIA_COLUMNS} )
`;

const DETAIL_COLUMNS = `
  id, slug, name, sku, summary, description_md, care_md, base_price_minor, currency,
  stock_qty, lead_time_days, dimensions, extra_specs, materials, updated_at, price_valid_until,
  categories!inner ( slug, name ),
  product_variants ( ${VARIANT_COLUMNS} ),
  media_assets ( ${MEDIA_COLUMNS} )
`;

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

interface MediaRow {
  id: string;
  provider: string;
  provider_ref: string;
  kind: string;
  alt_text: string;
  width: number;
  height: number;
  blur_data_url: string | null;
  poster_path: string | null;
  duration_s: number | null;
  position: number;
  variant_id: string | null;
  anchors: unknown;
}

interface VariantRow {
  id: string;
  kind: string | null;
  name: string;
  price_delta_minor: number | string;
  sku: string | null;
  stock_qty: number | null;
  material: string;
  swatch_hex: string | null;
}

interface CategoryJoin {
  slug: string;
  name: string;
}

interface CardRow {
  id: string;
  slug: string;
  name: string;
  sku: string;
  base_price_minor: number | string;
  currency: string | null;
  stock_qty: number | null;
  lead_time_days: number;
  dimensions: unknown;
  extra_specs: SpecEntry[] | null;
  materials: string[] | null;
  updated_at: string;
  categories: CategoryJoin | CategoryJoin[] | null;
  media_assets: MediaRow[] | null;
}

interface DetailRow extends CardRow {
  summary: string | null;
  description_md: string | null;
  care_md: string | null;
  price_valid_until: string | null;
  product_variants: VariantRow[] | null;
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/** PostgREST returns an embedded to-one relation as an object or a one-element array. */
function one<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Money arrives as a JSON number from PostgREST. It leaves this file as a string. */
function minorToString(value: number | string): string {
  if (typeof value === 'string') return value;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Money value ${value} is not a safe integer; it lost precision in transit.`);
  }
  return String(value);
}

function toDimensions(value: unknown): Dimensions | null {
  // A piece that has not been measured yet lists without dimensions rather than
  // failing the whole page or rendering an invented number.
  if (typeof value !== 'object' || value === null) return null;
  const d = value as Record<string, unknown>;
  const num = (k: string): number => {
    const n = d[k];
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new Error(`products.dimensions.${k} is not a number`);
    }
    return n;
  };
  try {
    const seat = d['seatH'];
    const base = { w: num('w'), d: num('d'), h: num('h') };
    return typeof seat === 'number' ? { ...base, seatH: seat } : base;
  } catch {
    return null;
  }
}

function toAnchors(value: unknown): MediaAnchors | null {
  if (typeof value !== 'object' || value === null) return null;
  const a = value as Record<string, unknown>;
  const keys = ['x1', 'y1', 'x2', 'y2'] as const;
  if (!keys.every((k) => typeof a[k] === 'number')) return null;
  return { x1: a['x1'] as number, y1: a['y1'] as number, x2: a['x2'] as number, y2: a['y2'] as number };
}

function toMedia(rows: MediaRow[] | null): MediaAsset[] {
  if (!rows) return [];
  const out: MediaAsset[] = [];

  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    const provider =
      r.provider === 'mux' || r.provider === 'youtube' || r.provider === 'local'
        ? r.provider
        : 'supabase';

    const base = {
      id: r.id,
      provider,
      providerRef: r.provider_ref,
      alt: r.alt_text,
      width: r.width,
      height: r.height,
      blurDataUrl: r.blur_data_url,
      position: r.position,
      variantId: r.variant_id,
      anchors: toAnchors(r.anchors),
    } as const;

    if (r.kind === 'video') {
      // A video without a poster would render an empty slot; ADR-003 makes the
      // poster mandatory at upload, so a row missing one is a data bug, not a
      // rendering case to design around. Skip it rather than ship a hole.
      if (!r.poster_path) continue;
      out.push({ ...base, kind: 'video', posterRef: r.poster_path, durationSeconds: r.duration_s ?? 0 });
    } else {
      out.push({ ...base, kind: 'image' });
    }
  }

  return out;
}

function toVariants(rows: VariantRow[] | null): Variant[] {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    // `kind` distinguishes a finish swatch from a size control. Until the column
    // exists, anything without an explicit kind is a finish.
    kind: r.kind === 'size' ? ('size' as const) : ('finish' as const),
    name: r.name,
    priceDeltaMinor: minorToString(r.price_delta_minor),
    sku: r.sku,
    stockQty: r.stock_qty,
    material: r.material,
    swatchHex: r.swatch_hex,
  }));
}

function toCard(row: CardRow): ProductCardModel {
  const category = one(row.categories);
  const media = toMedia(row.media_assets);
  const image = media.find((m) => m.kind === 'image' && m.variantId === null);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    basePriceMinor: minorToString(row.base_price_minor),
    currency: row.currency ?? CURRENCY,
    stockQty: row.stock_qty,
    leadTimeDays: row.lead_time_days,
    dimensions: toDimensions(row.dimensions),
    extraSpecs: Array.isArray(row.extra_specs) ? row.extra_specs : [],
    categorySlug: category?.slug ?? '',
    categoryName: category?.name ?? '',
    primaryImage: image && image.kind === 'image' ? image : null,
    materials: row.materials ?? [],
    updatedAt: row.updated_at,
  };
}

function toDetail(row: DetailRow): ProductDetailModel {
  const validUntil =
    row.price_valid_until ??
    new Date(new Date(row.updated_at).setUTCFullYear(new Date(row.updated_at).getUTCFullYear() + 1))
      .toISOString()
      .slice(0, 10);

  return {
    ...toCard(row),
    summary: row.summary ?? '',
    descriptionMd: row.description_md ?? '',
    careMd: row.care_md ?? '',
    media: toMedia(row.media_assets),
    variants: toVariants(row.product_variants),
    priceValidUntil: validUntil,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function dbGetCategories(): Promise<CategorySummary[]> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, blurb, updated_at, products!inner ( id )')
    .eq('products.status', 'published')
    .order('position', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      slug: string;
      name: string;
      blurb: string | null;
      updated_at: string;
      products: { id: string }[] | null;
    };
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      blurb: r.blurb ?? '',
      updatedAt: r.updated_at,
      productCount: r.products?.length ?? 0,
      cover: null,
    };
  });
}

export async function dbGetProduct(slug: string): Promise<ProductDetailModel | null> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toDetail(data as unknown as DetailRow);
}

export async function dbGetListing(query: ListingQuery): Promise<ListingResult> {
  const supabase = catalogueClient();
  const from = (query.page - 1) * PER_PAGE;

  let q = supabase
    .from('products')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .eq('categories.slug', query.categorySlug);

  if (query.material) q = q.contains('materials', [query.material]);

  const band = PRICE_BANDS.find((b) => b.slug === query.priceBand);
  if (band?.minMinor) q = q.gte('base_price_minor', band.minMinor);
  if (band?.maxMinor) q = q.lt('base_price_minor', band.maxMinor);

  switch (query.sort) {
    case 'price-asc':
      q = q.order('base_price_minor', { ascending: true });
      break;
    case 'price-desc':
      q = q.order('base_price_minor', { ascending: false });
      break;
    case 'newest':
      q = q.order('updated_at', { ascending: false });
      break;
    case 'featured':
    default:
      q = q.order('position', { ascending: true }).order('name', { ascending: true });
      break;
  }

  const { data, error, count } = await q.range(from, from + PER_PAGE - 1);
  if (error) throw error;

  const items = (data ?? []).map((row) => toCard(row as unknown as CardRow));
  const total = count ?? items.length;

  const { data: materialRows } = await supabase
    .from('products')
    .select('materials, categories!inner ( slug )')
    .eq('status', 'published')
    .eq('categories.slug', query.categorySlug);

  const materials = [
    ...new Set(
      (materialRows ?? []).flatMap((r) => (r as unknown as { materials: string[] | null }).materials ?? []),
    ),
  ].sort();

  return {
    items,
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    perPage: PER_PAGE,
    materials,
  };
}

export async function dbGetRelated(slug: string, categorySlug: string): Promise<ProductCardModel[]> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'published')
    .eq('categories.slug', categorySlug)
    .neq('slug', slug)
    .limit(4);

  if (error) throw error;
  return (data ?? []).map((row) => toCard(row as unknown as CardRow));
}

export async function dbGetFeatured(): Promise<ProductCardModel[]> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'published')
    .eq('is_featured', true)
    .limit(6);

  if (error) throw error;
  return (data ?? []).map((row) => toCard(row as unknown as CardRow));
}

export async function dbSearch(term: string): Promise<ProductCardModel[]> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('products')
    .select(CARD_COLUMNS)
    .eq('status', 'published')
    .textSearch('search_vector', term, { type: 'websearch', config: 'english' })
    .limit(24);

  if (error) throw error;
  return (data ?? []).map((row) => toCard(row as unknown as CardRow));
}

export async function dbGetAllPublished(): Promise<
  Array<{ slug: string; updatedAt: string; image: string | null }>
> {
  const supabase = catalogueClient();
  const { data, error } = await supabase
    .from('products')
    .select('slug, updated_at, media_assets ( provider_ref, kind, position )')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      slug: string;
      updated_at: string;
      media_assets: Array<{ provider_ref: string; kind: string; position: number }> | null;
    };
    const first = (r.media_assets ?? [])
      .filter((m) => m.kind === 'image')
      .sort((a, b) => a.position - b.position)[0];
    return { slug: r.slug, updatedAt: r.updated_at, image: first?.provider_ref ?? null };
  });
}
