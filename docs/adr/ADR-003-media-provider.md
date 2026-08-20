# ADR-003 — Media provider abstraction, Supabase Storage today

**Status:** Accepted · 2026-08-20

## Context

Furniture sells on photography and short showcase video. Images are
straightforward: Supabase Storage plus `next/image` gives resizing, modern
formats and lazy loading.

Video is not. **Supabase Storage serves files. It does not transcode, and it does
not produce HLS or DASH.** A 60 MB MP4 is downloaded whole by a phone on a slow
connection, because there is no adaptive bitrate ladder to step down to. The
merchant will not know this, and will upload whatever the camera produced.

Committing to a paid video host on day one is premature — Mux and Cloudinary both
cost money a single-merchant site may not need. Committing to no abstraction is
worse, because it turns a future migration into a schema rewrite.

## Decision

`media_assets` carries `provider text default 'supabase'` and `provider_ref
text`, populated on **every** asset including Supabase-hosted ones.

Rendering goes through one `<Media>` component that branches on `provider`. The
storefront never constructs a media URL inline.

Constraints enforced in the upload UI, not merely documented:

- video at most 20s and at most 8 MB, muted, `playsInline`, autoplay on scroll
- a poster image is required for every video, so the slot is never empty
- above the threshold the uploader warns and states the consequence for shoppers
  on slow connections. It does not silently accept, and it does not silently
  reject
- `width`, `height`, `duration_s` and `blur_data_url` are extracted at upload and
  persisted, so every media slot has a fixed aspect ratio and zero layout shift

## Consequences

- Swapping to Mux later is a data migration plus one component branch. It costs
  one column today.
- Video quality is capped at what an 8 MB, 20-second file looks like. That is a
  real product limitation and the honest trade for not paying for transcoding.
- `alt_text` is `not null` at the database level. Save is blocked until it is
  written, with a one-line explanation. Making it a constraint means it cannot be
  skipped under deadline pressure.
- Resumable upload (TUS) is used for video, because a failed 8 MB upload over a
  Kenyan mobile connection is a routine event, not an edge case.

## Escape hatch, stated concretely

When video starts to matter more than it does today: add `mux` to the provider
check constraint, write new assets with `provider = 'mux'` and `provider_ref` set
to the playback id, add a branch to `<Media>`, then backfill old assets or leave
them on Supabase. Both providers coexist during the migration. No schema rewrite.

## Rejected alternatives

**YouTube embeds.** Free transcoding, but the player carries third-party script
weight, YouTube branding, and related-video surfaces on a page whose entire job
is to sell one sofa. Retained as a provider value for merchant use, not as the
default.

**Mux from day one.** The right answer if video were central. It is not yet, and
a paid dependency in a build with no other paid dependency is hard to justify.
Rejected for now — the abstraction exists precisely so this stays cheap to
revisit.
