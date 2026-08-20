-- Catalogue: categories, products, variants, media.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index categories_position_idx on public.categories (position, name);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table public.products (
  id               uuid primary key default extensions.gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  summary          text,
  description_md   text,
  category_id      uuid references public.categories (id) on delete restrict,

  -- Minor units. The only price a customer can be charged is derived from this
  -- column inside place_order. See ADR-002 and ADR-006.
  base_price_minor bigint not null check (base_price_minor >= 0),
  currency         char(3) not null default 'KES',

  status           text not null default 'draft'
                     check (status in ('draft', 'published', 'archived')),

  lead_time_days   integer not null default 14 check (lead_time_days >= 0),

  -- NULL means made to order, which is not the same as zero and must never
  -- render as "out of stock". See docs/domain.md section 8.
  stock_qty        integer check (stock_qty >= 0),

  dimensions       jsonb,          -- {w, d, h, unit}
  materials        text[] not null default '{}',
  care_notes       text,

  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  search_vector    tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(care_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description_md, '')), 'D')
  ) stored,

  constraint products_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_name_present check (length(trim(name)) > 0),
  constraint products_published_has_timestamp
    check (status <> 'published' or published_at is not null),
  constraint products_dimensions_shape
    check (dimensions is null or jsonb_typeof(dimensions) = 'object')
);

comment on column public.products.stock_qty is
  'NULL = made to order. 0 = unavailable. Never conflate the two.';

create index products_status_published_idx
  on public.products (status, published_at desc)
  where status = 'published';

create index products_category_idx on public.products (category_id)
  where status = 'published';

create index products_price_idx on public.products (base_price_minor)
  where status = 'published';

create index products_search_idx on public.products using gin (search_vector);

create index products_materials_idx on public.products using gin (materials);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- published_at is stamped once, the first time a product goes live, and is not
-- rewritten by later edits.
create or replace function public.stamp_product_published_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $fn$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$fn$;

create trigger products_stamp_published_at
  before insert or update on public.products
  for each row execute function public.stamp_product_published_at();

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------

create table public.product_variants (
  id                uuid primary key default extensions.gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  name              text not null,                    -- "Walnut / Boucle"
  price_delta_minor bigint not null default 0,        -- may be negative
  sku               text unique,
  stock_qty         integer check (stock_qty >= 0),
  swatch_hex        text,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint product_variants_name_present check (length(trim(name)) > 0),
  constraint product_variants_swatch_hex_shape
    check (swatch_hex is null or swatch_hex ~ '^#[0-9a-fA-F]{6}$'),
  constraint product_variants_unique_name unique (product_id, name)
);

create index product_variants_product_idx
  on public.product_variants (product_id, position);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id            uuid primary key default extensions.gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  kind          text not null check (kind in ('image', 'video')),

  -- Written on every asset including Supabase-hosted ones, so swapping video
  -- hosts later is a data migration and one component branch. See ADR-003.
  provider      text not null default 'supabase'
                  check (provider in ('supabase', 'mux', 'cloudinary', 'youtube')),
  provider_ref  text,

  storage_path  text,
  poster_path   text,

  -- NOT NULL on purpose. Blocking the save is the only reliable way to stop alt
  -- text being skipped under deadline pressure. SEO and accessibility.
  alt_text      text not null,

  width         integer check (width > 0),
  height        integer check (height > 0),
  duration_s    numeric(6, 2) check (duration_s > 0),
  blur_data_url text,
  position      integer not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),

  constraint media_assets_alt_text_present check (length(trim(alt_text)) > 0),

  -- A supabase-hosted asset has to live somewhere; an external one has to have
  -- a reference. Neither can be half-configured.
  constraint media_assets_locatable check (
    (provider = 'supabase' and storage_path is not null)
    or (provider <> 'supabase' and provider_ref is not null)
  ),

  -- Video without a poster leaves an empty slot on a slow connection, which is
  -- the exact failure ADR-003 exists to prevent.
  constraint media_assets_video_has_poster
    check (kind <> 'video' or poster_path is not null),

  -- Zero CLS requires knowing the aspect ratio before the bytes arrive.
  constraint media_assets_image_has_dimensions
    check (kind <> 'image' or (width is not null and height is not null)),

  constraint media_assets_video_duration_cap
    check (kind <> 'video' or duration_s is null or duration_s <= 20)
);

create index media_assets_product_idx
  on public.media_assets (product_id, position);

create unique index media_assets_one_primary_per_product
  on public.media_assets (product_id)
  where is_primary;
