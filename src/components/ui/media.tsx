import Image from 'next/image';

import { mediaUrl } from '@/lib/catalog/media-url';
import type { MediaAsset } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';
import { ProductVideo } from './product-video';

/**
 * Every media slot on the storefront goes through here (ADR-003). The storefront
 * never constructs a media URL inline, so moving a provider is a branch in this
 * file rather than a search across the codebase.
 *
 * The wrapper carries `aspect-ratio` from the stored width/height, so the slot
 * has its final size before the bytes arrive. That is the whole CLS story.
 */
export function Media({
  asset,
  sizes,
  priority = false,
  quality = 80,
  className,
  imageClassName,
}: {
  asset: MediaAsset;
  /**
   * Required. A wrong `sizes` is the most common cause of a slow LCP on an
   * image grid: it silently ships a 1600px file to a 390px viewport.
   */
  sizes: string;
  priority?: boolean;
  quality?: 70 | 80 | 90;
  className?: string;
  imageClassName?: string;
}) {
  if (asset.kind === 'video') {
    return <ProductVideo asset={asset} className={className} />;
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-sunken', className)}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      <Image
        src={mediaUrl(asset)}
        alt={asset.alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        // Only the LCP image should be eager; everything else waits its turn.
        loading={priority ? 'eager' : 'lazy'}
        {...(asset.blurDataUrl ? { placeholder: 'blur' as const, blurDataURL: asset.blurDataUrl } : {})}
        className={cn('object-cover', imageClassName)}
      />
    </div>
  );
}

/** An empty slot that still reserves its space, so a missing image cannot shift the page. */
export function MediaPlaceholder({
  ratio = '4 / 3',
  className,
  label = 'Photography pending',
}: {
  ratio?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'grid place-items-center border border-rule bg-surface-sunken text-step--1 text-ink-muted',
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      <span className="font-mono uppercase tracking-wide">{label}</span>
    </div>
  );
}
