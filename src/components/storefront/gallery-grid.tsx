'use client';

// "use client" because a gallery without a full-size viewer is a contact sheet.
// The viewer is a native <dialog>, which gives focus trapping, Escape-to-close
// and an inert background without a dialog library.

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { GalleryPhoto } from '@/lib/catalog/gallery';
import { cn } from '@/lib/utils/cn';

/**
 * A masonry column layout via CSS `columns`, so photographs keep the proportions
 * they were taken at instead of being cropped into a uniform grid. Each tile
 * still carries its own width/height, so the column heights settle before the
 * bytes arrive and nothing reflows as the page loads.
 */
export function GalleryGrid({ photos }: { photos: readonly GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const current = openIndex === null ? null : (photos[openIndex] ?? null);

  const move = useCallback(
    (delta: number) => {
      setOpenIndex((i) => {
        if (i === null) return i;
        const next = i + delta;
        if (next < 0) return photos.length - 1;
        if (next >= photos.length) return 0;
        return next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  }, [current]);

  useEffect(() => {
    if (!current) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, move]);

  return (
    <>
      <ul className="gap-4 [column-count:1] xs:[column-count:2] md:[column-count:3] lg:[column-count:4]">
        {photos.map((photo, i) => (
          <li key={photo.id} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group block w-full cursor-zoom-in border border-rule transition-colors hover:border-rule-strong"
              aria-label={`Open larger: ${photo.alt}`}
            >
              <span
                className="relative block w-full overflow-hidden bg-surface-sunken"
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
              >
                <Image
                  src={photo.path}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 64rem) 23vw, (min-width: 48rem) 31vw, (min-width: 30rem) 47vw, 92vw"
                  quality={80}
                  placeholder="blur"
                  blurDataURL={photo.blurDataUrl}
                  className="object-cover"
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenIndex(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenIndex(null);
        }}
        className="max-h-dvh max-w-dvw bg-surface p-0 backdrop:bg-ink/85"
      >
        {current && (
          <div className="flex max-h-dvh flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-2">
              <p className="font-mono text-step--1 tabular-nums text-ink-muted">
                {(openIndex ?? 0) + 1} of {photos.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="border border-rule-strong px-3 py-1 font-mono text-step--1 hover:border-ink"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="border border-rule-strong px-3 py-1 font-mono text-step--1 hover:border-ink"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setOpenIndex(null)}
                  className="border border-rule-strong px-3 py-1 font-mono text-step--1 hover:border-ink"
                >
                  Close
                </button>
              </div>
            </div>

            <Image
              src={current.path}
              alt={current.alt}
              width={current.width}
              height={current.height}
              quality={90}
              className={cn('h-auto max-h-(--viewer-max) w-auto object-contain')}
            />

            <p className="border-t border-rule px-4 py-2 text-step--1 text-ink-muted">
              {current.alt}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
