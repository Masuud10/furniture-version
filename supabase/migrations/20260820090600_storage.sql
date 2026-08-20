-- Storage buckets and their policies.
--
-- Two buckets, because "not published yet" and "on the internet" are different
-- things and a public bucket cannot express the difference.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-media',
    'product-media',
    true,
    -- 8 MB. The cap is the video constraint from ADR-003 made real: Supabase
    -- Storage does not transcode, so whatever is uploaded is what a phone on a
    -- slow connection downloads, whole.
    8388608,
    array[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif',
      'video/mp4', 'video/webm'
    ]
  ),
  (
    'product-drafts',
    'product-drafts',
    false,
    8388608,
    array[
      'image/jpeg', 'image/png', 'image/webp', 'image/avif',
      'video/mp4', 'video/webm'
    ]
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- product-media — public read, admin write
-- ---------------------------------------------------------------------------

create policy "product-media: anyone can read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-media');

create policy "product-media: admin uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin replaces"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-media' and public.is_admin())
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin removes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- product-drafts — admin only, in every direction
-- ---------------------------------------------------------------------------

create policy "product-drafts: admin only"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'product-drafts' and public.is_admin())
  with check (bucket_id = 'product-drafts' and public.is_admin());
