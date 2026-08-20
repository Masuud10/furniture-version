'use client';

// "use client" because autoplay-on-scroll needs IntersectionObserver and the
// reduced-motion decision has to be made in the browser, not at build time.
// Nothing else in the media path ships JavaScript.

import { useEffect, useRef, useState } from 'react';

import { mediaUrl, posterUrl } from '@/lib/catalog/media-url';
import type { MediaAsset } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';

export function ProductVideo({
  asset,
  className,
}: {
  asset: Extract<MediaAsset, { kind: 'video' }>;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Never autoplay when motion is reduced. The poster and the controls remain,
    // so the video is still available — it just does not start on its own.
    if (reducedMotion) {
      el.pause();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void el.play().catch(() => {
              /* autoplay refused by the browser; the poster and controls stand in */
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      className={cn('relative overflow-hidden bg-surface-sunken', className)}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        // metadata only: an 8 MB file on a slow connection must not be pulled
        // down before the shopper has decided to look at it (ADR-003).
        preload="metadata"
        poster={posterUrl(asset)}
        muted
        playsInline
        loop
        controls
        aria-label={asset.alt}
      >
        <source src={mediaUrl(asset)} type="video/mp4" />
      </video>
    </div>
  );
}
