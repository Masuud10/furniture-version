import type { MediaAsset, MediaProvider } from './types';

/**
 * The one place a media URL is constructed. The storefront never builds one
 * inline (ADR-003), so swapping a provider is a change here and a branch in
 * <Media>, not a search across the codebase.
 *
 * No `server-only` here on purpose: the gallery is a client component and needs
 * the same URLs the server rendered.
 */

function supabasePublicUrl(ref: string, bucket = 'product-media'): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/${bucket}/${ref.replace(/^\/+/, '')}`;
}

export function providerUrl(provider: MediaProvider, ref: string): string {
  switch (provider) {
    case 'local':
      // Drafting plates served from /public while photography is pending.
      return ref.startsWith('/') ? ref : `/${ref}`;
    case 'mux':
      return `https://stream.mux.com/${ref}.m3u8`;
    case 'youtube':
      return `https://www.youtube.com/watch?v=${ref}`;
    case 'supabase':
    default:
      return supabasePublicUrl(ref);
  }
}

export function mediaUrl(asset: MediaAsset): string {
  return providerUrl(asset.provider, asset.providerRef);
}

/** Poster for a video slot. Posters always live in storage, never on the video host. */
export function posterUrl(asset: Extract<MediaAsset, { kind: 'video' }>): string {
  return asset.provider === 'local' ? providerUrl('local', asset.posterRef) : supabasePublicUrl(asset.posterRef);
}

/** ISO 8601 duration, which is the only form `VideoObject.duration` accepts. */
export function isoDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return m > 0 ? `PT${m}M${s}S` : `PT${s}S`;
}
