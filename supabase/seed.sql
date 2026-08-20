-- Demo dataset. Applied by `supabase db reset`.
--
-- Runs as the database owner, so it is not filtered by RLS. That is fine here
-- and is exactly why the hostile tests in supabase/tests connect as a role
-- instead: seeding proves nothing about authorization.
--
-- Media rows point at storage paths that hold no bytes. The schema is
-- consistent; the images are not there. Phase 4 uploads real files.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- Password for every seeded account: password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'admin@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Amina Wanjiru","phone":"+254711000001"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'joy@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Joy Kamau","phone":"+254722000002"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'peter@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Peter Otieno","phone":"+254733000003"}',
   now(), now(), '', '', '', '');

-- Password sign-in needs an identity row alongside the user.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id, u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- handle_new_user created these rows. Promote one of them.
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

-- Peter has stood a driver up once. The merchant should see that.
update public.profiles set no_show_count = 1 where id = '33333333-3333-3333-3333-333333333333';

-- ---------------------------------------------------------------------------
-- Delivery zones
-- ---------------------------------------------------------------------------

insert into public.delivery_zones (id, name, fee_minor, active, position) values
  ('aaaa0001-0000-4000-8000-000000000001', 'Nairobi — within Ring Road',  150000, true, 1),
  ('aaaa0001-0000-4000-8000-000000000002', 'Nairobi — outer suburbs',     250000, true, 2),
  ('aaaa0001-0000-4000-8000-000000000003', 'Kiambu, Machakos, Kajiado',   450000, true, 3),
  ('aaaa0001-0000-4000-8000-000000000004', 'Upcountry — courier',        1200000, true, 4),
  ('aaaa0001-0000-4000-8000-000000000005', 'Mombasa (paused)',            900000, false, 5);

-- ---------------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------------

insert into public.addresses (
  id, user_id, label, recipient_name, phone, line1, line2, city, region,
  landmark, delivery_zone_id, is_default
) values
  ('bbbb0001-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Home', 'Joy Kamau', '+254722000002', 'Riara Road, Kilimani', 'Apt 4B',
   'Nairobi', 'Nairobi', 'Opposite the Java House', 'aaaa0001-0000-4000-8000-000000000001', true),
  ('bbbb0001-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Office', 'Joy Kamau', '+254722000002', 'Westlands Square, Ring Road', '3rd floor',
   'Nairobi', 'Nairobi', null, 'aaaa0001-0000-4000-8000-000000000002', false),
  ('bbbb0001-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333333',
   'Home', 'Peter Otieno', '+254733000003', 'Membley Estate', null,
   'Ruiru', 'Kiambu', 'Near the water tower', 'aaaa0001-0000-4000-8000-000000000003', true);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

insert into public.categories (id, slug, name, description, position) values
  ('cccc0001-0000-4000-8000-000000000001', 'seating', 'Seating',
   'Sofas, armchairs and benches, built for rooms people actually sit in.', 1),
  ('cccc0001-0000-4000-8000-000000000002', 'tables', 'Tables',
   'Dining, coffee and work surfaces in solid hardwood.', 2),
  ('cccc0001-0000-4000-8000-000000000003', 'storage', 'Storage',
   'Wardrobes, shelving and sideboards, made to the wall you have.', 3);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

insert into public.products (
  id, slug, name, summary, description_md, category_id, base_price_minor,
  status, lead_time_days, stock_qty, dimensions, materials, care_notes
) values
  ('dddd0001-0000-4000-8000-000000000001', 'kigali-three-seater', 'Kigali three-seater',
   'A deep three-seater in bouclé, on a solid mahogany frame.',
   'Built on a kiln-dried mahogany frame with webbed suspension. The cushions are high-density foam wrapped in feather, so they hold their shape rather than flattening in the first year.',
   'cccc0001-0000-4000-8000-000000000001', 8950000, 'published', 21, null,
   '{"w":2100,"d":950,"h":780,"unit":"mm"}', array['Mahogany','Bouclé','Feather'],
   'Vacuum weekly with a brush head. Rotate the cushions monthly. Keep out of direct sun.'),

  ('dddd0001-0000-4000-8000-000000000002', 'nanyuki-armchair', 'Nanyuki armchair',
   'A low armchair with a shaped back, sized for a small room.',
   'The back is steam-bent in one piece, so there is no joint across the shoulders. Sits lower than it looks.',
   'cccc0001-0000-4000-8000-000000000001', 3450000, 'published', 14, 4,
   '{"w":760,"d":820,"h":700,"unit":"mm"}', array['Oak','Wool'],
   'Brush along the grain of the wool. Wipe the frame with a barely damp cloth.'),

  ('dddd0001-0000-4000-8000-000000000003', 'lamu-daybed', 'Lamu daybed',
   'A slatted daybed in reclaimed teak, for a verandah.',
   'Made from reclaimed teak, so the colour varies piece to piece. That is the material, not a fault.',
   'cccc0001-0000-4000-8000-000000000001', 6200000, 'published', 28, null,
   '{"w":1900,"d":800,"h":420,"unit":"mm"}', array['Reclaimed teak','Canvas'],
   'Oil twice a year if it lives outside. Bring the cushion in when it rains.'),

  ('dddd0001-0000-4000-8000-000000000004', 'karen-bench', 'Karen bench',
   'A hallway bench with an open shelf for shoes.',
   'Sized to sit under a coat rail. The shelf takes six pairs.',
   'cccc0001-0000-4000-8000-000000000001', 1850000, 'published', 10, 7,
   '{"w":1200,"d":400,"h":450,"unit":"mm"}', array['Oak'],
   'Wipe with a dry cloth. Re-oil the top if it starts to look thirsty.'),

  ('dddd0001-0000-4000-8000-000000000005', 'rift-dining-table', 'Rift dining table',
   'A six-seat table with a breadboard end and a trestle base.',
   'The top is a single-slab lamination with breadboard ends, which lets it move with the seasons instead of splitting.',
   'cccc0001-0000-4000-8000-000000000002', 11500000, 'published', 35, null,
   '{"w":1800,"d":900,"h":750,"unit":"mm"}', array['Solid oak','Steel'],
   'Coasters under anything hot. Re-oil once a year with a hard-wax oil.'),

  ('dddd0001-0000-4000-8000-000000000006', 'thika-coffee-table', 'Thika coffee table',
   'A low table with a floating shelf, in walnut.',
   'The shelf is let into the sides with a housed joint, so nothing sags under a stack of books.',
   'cccc0001-0000-4000-8000-000000000002', 4200000, 'published', 18, 3,
   '{"w":1100,"d":600,"h":380,"unit":"mm"}', array['Walnut'],
   'Keep it out of direct sun; walnut lightens. Wipe spills straight away.'),

  ('dddd0001-0000-4000-8000-000000000007', 'ngong-desk', 'Ngong desk',
   'A writing desk with a shallow drawer and a cable channel.',
   'The drawer runs on wooden runners, waxed rather than metal-slid, because it is quieter.',
   'cccc0001-0000-4000-8000-000000000002', 5400000, 'published', 21, null,
   '{"w":1400,"d":700,"h":740,"unit":"mm"}', array['Oak','Brass'],
   'Wax the runners once a year. The brass will patinate; leave it or polish it.'),

  ('dddd0001-0000-4000-8000-000000000008', 'menengai-side-table', 'Menengai side table',
   'A round side table on three tapered legs.',
   'Three legs, so it never rocks on an uneven floor.',
   'cccc0001-0000-4000-8000-000000000002', 1450000, 'published', 10, 12,
   '{"w":450,"d":450,"h":550,"unit":"mm"}', array['Mahogany'],
   'Dry cloth. Nothing else needed.'),

  ('dddd0001-0000-4000-8000-000000000009', 'tsavo-wardrobe', 'Tsavo wardrobe',
   'A two-door wardrobe with a full-width hanging rail.',
   'Made to your ceiling height. The rail is a single length of steel, so it does not sag in the middle.',
   'cccc0001-0000-4000-8000-000000000003', 14800000, 'published', 42, null,
   '{"w":1600,"d":600,"h":2200,"unit":"mm"}', array['Oak veneer','Steel'],
   'Do not hang wet clothes. Wipe the doors with a barely damp cloth.'),

  ('dddd0001-0000-4000-8000-00000000000a', 'elgon-shelving', 'Elgon shelving',
   'Open shelving that bolts to the wall, in three widths.',
   'Wall-fixed rather than freestanding, which is why it can be this shallow.',
   'cccc0001-0000-4000-8000-000000000003', 3900000, 'published', 16, null,
   '{"w":900,"d":300,"h":1800,"unit":"mm"}', array['Ash','Steel'],
   'Check the wall fixings once a year.'),

  ('dddd0001-0000-4000-8000-00000000000b', 'sagana-sideboard', 'Sagana sideboard',
   'A low sideboard with two doors and a drawer bank.',
   'Sized to sit under a window without blocking the light.',
   'cccc0001-0000-4000-8000-000000000003', 9600000, 'published', 30, 1,
   '{"w":1600,"d":450,"h":720,"unit":"mm"}', array['Walnut','Brass'],
   'Wipe with a dry cloth. Re-oil the top annually.'),

  -- Draft and archived, so the hostile tests have something that must not leak.
  ('dddd0001-0000-4000-8000-00000000000c', 'meru-console', 'Meru console',
   'A narrow console for a hallway.',
   'Not finished being photographed.',
   'cccc0001-0000-4000-8000-000000000003', 2750000, 'draft', 14, null,
   '{"w":1000,"d":320,"h":800,"unit":"mm"}', array['Oak'],
   'Dry cloth.'),

  ('dddd0001-0000-4000-8000-00000000000d', 'kisumu-stool', 'Kisumu stool',
   'A three-legged stool. No longer made.',
   'Discontinued. Kept because orders reference it.',
   'cccc0001-0000-4000-8000-000000000001', 950000, 'archived', 7, 0,
   '{"w":350,"d":350,"h":450,"unit":"mm"}', array['Mahogany'],
   'Dry cloth.');

-- ---------------------------------------------------------------------------
-- Variants
-- ---------------------------------------------------------------------------

insert into public.product_variants (product_id, name, price_delta_minor, sku, stock_qty, swatch_hex, position) values
  ('dddd0001-0000-4000-8000-000000000001', 'Oatmeal bouclé',        0, 'KIG-3S-OAT', null, '#D8D2C4', 1),
  ('dddd0001-0000-4000-8000-000000000001', 'Charcoal bouclé',  150000, 'KIG-3S-CHR', null, '#3A3B3E', 2),
  ('dddd0001-0000-4000-8000-000000000001', 'Ochre wool',       320000, 'KIG-3S-OCH', null, '#B87A2B', 3),
  ('dddd0001-0000-4000-8000-000000000002', 'Slate wool',            0, 'NAN-AC-SLT',    2, '#5B6067', 1),
  ('dddd0001-0000-4000-8000-000000000002', 'Moss wool',         80000, 'NAN-AC-MOS',    2, '#4A5D48', 2),
  ('dddd0001-0000-4000-8000-000000000005', 'Oak, natural',          0, 'RIF-DT-NAT', null, '#C8A97E', 1),
  ('dddd0001-0000-4000-8000-000000000005', 'Oak, smoked',      450000, 'RIF-DT-SMK', null, '#6B5540', 2),
  ('dddd0001-0000-4000-8000-000000000006', 'Walnut',                0, 'THI-CT-WAL',    3, '#5C4033', 1),
  ('dddd0001-0000-4000-8000-000000000009', 'Oak veneer',            0, 'TSA-WD-OAK', null, '#C8A97E', 1),
  ('dddd0001-0000-4000-8000-000000000009', 'Painted, any colour', 900000, 'TSA-WD-PNT', null, '#EDEDEA', 2),
  ('dddd0001-0000-4000-8000-00000000000a', '900 mm wide',           0, 'ELG-SH-900', null, null, 1),
  ('dddd0001-0000-4000-8000-00000000000a', '1200 mm wide',     600000, 'ELG-SH-1200', null, null, 2),
  ('dddd0001-0000-4000-8000-00000000000a', '1500 mm wide',    1150000, 'ELG-SH-1500', null, null, 3),
  -- On the draft and the archived product, so the hostile tests have a variant
  -- that must not leak rather than an empty set that passes for free.
  ('dddd0001-0000-4000-8000-00000000000c', 'Oak, natural',          0, 'MER-CO-NAT', null, '#C8A97E', 1),
  ('dddd0001-0000-4000-8000-00000000000d', 'Mahogany',              0, 'KIS-ST-MAH',    0, '#6B4423', 1);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

-- One primary image per product, plus one short clip, so the gallery and the
-- video path both have something to render. blur_data_url is a 1x1 grey PNG
-- stand-in; Phase 4 generates real ones at upload.
insert into public.media_assets (
  product_id, kind, provider, provider_ref, storage_path, poster_path, alt_text,
  width, height, duration_s, blur_data_url, position, is_primary
)
select
  p.id, 'image', 'supabase', p.slug || '/01',
  'products/' || p.slug || '/01.jpg', null,
  p.name || ', photographed against a plain wall.',
  1600, 1200, null,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  1, true
from public.products p;

insert into public.media_assets (
  product_id, kind, provider, provider_ref, storage_path, poster_path, alt_text,
  width, height, duration_s, blur_data_url, position, is_primary
)
select
  p.id, 'image', 'supabase', p.slug || '/02',
  'products/' || p.slug || '/02.jpg', null,
  'A detail of the joinery on the ' || p.name || '.',
  1600, 1200, null,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  2, false
from public.products p
where p.status = 'published';

insert into public.media_assets (
  product_id, kind, provider, provider_ref, storage_path, poster_path, alt_text,
  width, height, duration_s, position, is_primary
) values
  ('dddd0001-0000-4000-8000-000000000001', 'video', 'supabase', 'kigali-three-seater/clip',
   'products/kigali-three-seater/clip.mp4', 'products/kigali-three-seater/clip-poster.jpg',
   'A slow pan across the Kigali three-seater in a lit room.', 1280, 720, 14.50, 3, false),
  ('dddd0001-0000-4000-8000-000000000005', 'video', 'supabase', 'rift-dining-table/clip',
   'products/rift-dining-table/clip.mp4', 'products/rift-dining-table/clip-poster.jpg',
   'A hand running along the breadboard end of the Rift dining table.', 1280, 720, 11.00, 3, false);

-- ---------------------------------------------------------------------------
-- Carts
-- ---------------------------------------------------------------------------

insert into public.carts (id, user_id) values
  ('eeee0001-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');

insert into public.cart_items (cart_id, product_id, variant_id, qty)
select 'eeee0001-0000-4000-8000-000000000001',
       'dddd0001-0000-4000-8000-000000000006',
       v.id, 1
from public.product_variants v where v.sku = 'THI-CT-WAL';

insert into public.cart_items (cart_id, product_id, variant_id, qty) values
  ('eeee0001-0000-4000-8000-000000000001', 'dddd0001-0000-4000-8000-000000000008', null, 2);

-- ---------------------------------------------------------------------------
-- Orders — one in every status, so the board and the timeline both have
-- something real to render.
-- ---------------------------------------------------------------------------

do $seed$
declare
  v_specs constant jsonb := jsonb_build_array(
    jsonb_build_object('status','pending_confirmation','user','22222222-2222-2222-2222-222222222222','addr','bbbb0001-0000-4000-8000-000000000001','product','dddd0001-0000-4000-8000-000000000001','sku','KIG-3S-CHR','qty',1,'days',0),
    jsonb_build_object('status','confirmed','user','22222222-2222-2222-2222-222222222222','addr','bbbb0001-0000-4000-8000-000000000001','product','dddd0001-0000-4000-8000-000000000005','sku','RIF-DT-SMK','qty',1,'days',2),
    jsonb_build_object('status','in_production','user','33333333-3333-3333-3333-333333333333','addr','bbbb0001-0000-4000-8000-000000000003','product','dddd0001-0000-4000-8000-000000000009','sku','TSA-WD-PNT','qty',1,'days',9),
    jsonb_build_object('status','ready_for_delivery','user','22222222-2222-2222-2222-222222222222','addr','bbbb0001-0000-4000-8000-000000000002','product','dddd0001-0000-4000-8000-000000000007','sku',null,'qty',1,'days',16),
    jsonb_build_object('status','out_for_delivery','user','33333333-3333-3333-3333-333333333333','addr','bbbb0001-0000-4000-8000-000000000003','product','dddd0001-0000-4000-8000-000000000004','sku',null,'qty',2,'days',20),
    jsonb_build_object('status','delivered','user','22222222-2222-2222-2222-222222222222','addr','bbbb0001-0000-4000-8000-000000000001','product','dddd0001-0000-4000-8000-000000000002','sku','NAN-AC-SLT','qty',1,'days',30),
    jsonb_build_object('status','cancelled','user','33333333-3333-3333-3333-333333333333','addr','bbbb0001-0000-4000-8000-000000000003','product','dddd0001-0000-4000-8000-000000000008','sku',null,'qty',1,'days',40),
    jsonb_build_object('status','returned','user','22222222-2222-2222-2222-222222222222','addr','bbbb0001-0000-4000-8000-000000000002','product','dddd0001-0000-4000-8000-00000000000b','sku',null,'qty',1,'days',55)
  );
  v_spec        jsonb;
  v_status      public.order_status;
  v_addr        public.addresses;
  v_zone        public.delivery_zones;
  v_product     public.products;
  v_variant     public.product_variants;
  v_unit        bigint;
  v_qty         integer;
  v_subtotal    bigint;
  v_order_id    uuid;
  v_placed      timestamptz;
  v_reason      public.cancellation_reason;
  v_path        public.order_status[];
  v_step        public.order_status;
  v_prev        public.order_status;
  v_i           integer;
  v_image       text;
begin
  for v_spec in select * from jsonb_array_elements(v_specs) loop
    v_status := (v_spec ->> 'status')::public.order_status;
    v_qty    := (v_spec ->> 'qty')::integer;
    v_placed := now() - ((v_spec ->> 'days')::integer * interval '1 day') - interval '3 hours';

    select * into v_addr from public.addresses where id = (v_spec ->> 'addr')::uuid;
    select * into v_zone from public.delivery_zones where id = v_addr.delivery_zone_id;
    select * into v_product from public.products where id = (v_spec ->> 'product')::uuid;

    v_variant := null;
    if v_spec ->> 'sku' is not null then
      select * into v_variant from public.product_variants where sku = v_spec ->> 'sku';
    end if;

    v_unit := v_product.base_price_minor + coalesce(v_variant.price_delta_minor, 0);
    v_subtotal := v_unit * v_qty;

    select m.storage_path into v_image
    from public.media_assets m
    where m.product_id = v_product.id and m.kind = 'image'
    order by m.is_primary desc, m.position asc limit 1;

    v_reason := case
      when v_status = 'cancelled' then 'customer_no_show'::public.cancellation_reason
      when v_status = 'returned'  then 'damaged_in_transit'::public.cancellation_reason
      else null
    end;

    insert into public.orders (
      user_id, status, payment_status, cancellation_reason,
      subtotal_minor, delivery_fee_minor, total_minor, currency,
      delivery_address, delivery_zone_name, contact_phone,
      customer_note, idempotency_key, placed_at
    ) values (
      (v_spec ->> 'user')::uuid,
      v_status,
      case when v_status = 'delivered' then 'paid' else 'unpaid' end::public.payment_status,
      v_reason,
      v_subtotal, v_zone.fee_minor, v_subtotal + v_zone.fee_minor, v_product.currency,
      jsonb_build_object(
        'label', v_addr.label, 'recipient_name', v_addr.recipient_name,
        'phone', v_addr.phone, 'line1', v_addr.line1, 'line2', v_addr.line2,
        'city', v_addr.city, 'region', v_addr.region, 'landmark', v_addr.landmark,
        'zone', v_zone.name
      ),
      v_zone.name, v_addr.phone,
      case when v_status = 'pending_confirmation'
           then 'Please call after 6pm.' else null end,
      'seed-' || v_status::text,
      v_placed
    )
    returning id into v_order_id;

    insert into public.order_items (
      order_id, product_id, variant_id, name_snapshot, variant_snapshot,
      image_snapshot, unit_price_minor, qty, line_total_minor
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.name,
      v_image, v_unit, v_qty, v_subtotal
    );

    -- Walk the real path to this status so the timeline reads like a story
    -- rather than a single mysterious jump.
    v_path := case v_status
      when 'pending_confirmation' then array['pending_confirmation']::public.order_status[]
      when 'confirmed'            then array['pending_confirmation','confirmed']::public.order_status[]
      when 'in_production'        then array['pending_confirmation','confirmed','in_production']::public.order_status[]
      when 'ready_for_delivery'   then array['pending_confirmation','confirmed','in_production','ready_for_delivery']::public.order_status[]
      when 'out_for_delivery'     then array['pending_confirmation','confirmed','in_production','ready_for_delivery','out_for_delivery']::public.order_status[]
      when 'delivered'            then array['pending_confirmation','confirmed','in_production','ready_for_delivery','out_for_delivery','delivered']::public.order_status[]
      when 'cancelled'            then array['pending_confirmation','confirmed','cancelled']::public.order_status[]
      when 'returned'             then array['pending_confirmation','confirmed','in_production','ready_for_delivery','out_for_delivery','delivered','returned']::public.order_status[]
    end;

    v_prev := null;
    v_i := 0;
    foreach v_step in array v_path loop
      insert into public.order_events (order_id, actor_id, from_status, to_status, note, created_at)
      values (
        v_order_id,
        case when v_prev is null then (v_spec ->> 'user')::uuid
             else '11111111-1111-1111-1111-111111111111' end,
        v_prev, v_step,
        case v_step
          when 'pending_confirmation' then 'Order placed.'
          when 'confirmed'            then 'Called the customer. They confirmed the order and the delivery day.'
          when 'in_production'        then 'Cutting list issued to the workshop.'
          when 'ready_for_delivery'   then 'Finished and wrapped.'
          when 'out_for_delivery'     then 'With the driver.'
          when 'delivered'            then 'Handed over and signed for.'
          when 'cancelled'            then 'Driver arrived, nobody at the address, phone unanswered.'
          when 'returned'             then 'A corner was chipped in transit. Collected and refunded in cash.'
        end,
        v_placed + (v_i * interval '30 hours')
      );
      v_prev := v_step;
      v_i := v_i + 1;
    end loop;
  end loop;
end;
$seed$;
