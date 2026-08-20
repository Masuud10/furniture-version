'use client';

// "use client" because the gallery is arrow-key navigable and opens a full-screen
// viewer. The fullscreen viewer is a native <dialog>, which gives focus trapping,
// Escape-to-close and inert background without a dialog library.

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mediaUrl, posterUrl } from '@/lib/catalog/media-url';
import type { Dimensions, MediaAsset } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';
import { DimensionFigure } from './dimension-figure';
import { Media } from '@/components/ui/media';
import { useVariant } from './variant-context';

export function ProductGallery({
  media,
  dimensions,
  productName,
}: {
  media: readonly MediaAsset[];
  dimensions: Dimensions | null;
  productName: string;
}) {
  const { selected } = useVariant();
  const selectedId = selected?.id ?? null;
  // Index is stored with the finish it belongs to. Swapping finish must reset to
  // that finish's first frame, and doing it during render rather than in an
  // effect avoids a second commit that would flash the wrong image first.
  const [gallery, setGallery] = useState<{ variantId: string | null; index: number }>({
    variantId: selectedId,
    index: 0,
  });
  if (gallery.variantId !== selectedId) {
    setGallery({ variantId: selectedId, index: 0 });
  }
  const index = gallery.index;
  const setIndex = (next: number | ((current: number) => number)) =>
    setGallery((g) => ({
      variantId: g.variantId,
      index: typeof next === 'function' ? next(g.index) : next,
    }));
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Imagery for the selected finish, falling back to the product-level set when
  // a variant has none of its own.
  const variantMedia = selected ? media.filter((m) => m.variantId === selected.id) : [];
  const shown = variantMedia.length > 0 ? variantMedia : media.filter((m) => m.variantId === null);

  const safeIndex = Math.min(index, Math.max(0, shown.length - 1));
  const current = shown[safeIndex];

  const move = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta;
        if (next < 0) return shown.length - 1;
        if (next >= shown.length) return 0;
        return next;
      });
    },
    [shown.length],
  );

  function onRailKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setIndex(shown.length - 1);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (viewerOpen && !dialog.open) dialog.showModal();
    if (!viewerOpen && dialog.open) dialog.close();
  }, [viewerOpen]);

  if (!current) return null;

  return (
    <div>
      <DimensionFigure
        dimensions={dimensions}
        anchors={current.kind === 'image' ? current.anchors : null}
        axes="wdh"
        className="border border-rule"
      >
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="block w-full cursor-zoom-in"
          aria-label={`Open ${productName} at full size`}
        >
          <Media
            asset={current}
            sizes="(min-width: 64rem) 52vw, 94vw"
            priority={safeIndex === 0}
            quality={90}
          />
        </button>
      </DimensionFigure>

      {shown.length > 1 && (
        <div
          ref={railRef}
          role="listbox"
          aria-label={`${productName} images`}
          aria-orientation="horizontal"
          tabIndex={0}
          onKeyDown={onRailKeyDown}
          className="mt-3 flex w-full min-w-0 gap-3 overflow-x-auto"
        >
          {shown.map((asset, i) => (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={i === safeIndex}
              tabIndex={-1}
              onClick={() => setIndex(i)}
              className={cn(
                'relative h-16 w-20 shrink-0 border transition-colors',
                i === safeIndex ? 'border-accent' : 'border-rule hover:border-rule-strong',
              )}
            >
              <Image
                src={asset.kind === 'video' ? posterUrl(asset) : mediaUrl(asset)}
                alt=""
                fill
                sizes="80px"
                quality={70}
                className="object-cover"
              />
              <span className="sr-only">{asset.alt}</span>
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setViewerOpen(false)}
        onClick={(event) => {
          // Click on the backdrop closes; a click on the image does not.
          if (event.target === dialogRef.current) setViewerOpen(false);
        }}
        className="max-h-dvh max-w-dvw bg-surface p-0 backdrop:bg-ink/80"
      >
        {viewerOpen && current.kind === 'image' && (
          <div className="relative flex max-h-dvh flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-2">
              <p className="font-mono text-step--1 text-ink-muted">
                {productName} — {safeIndex + 1} of {shown.length}
              </p>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="border border-rule-strong px-3 py-1 font-mono text-step--1 hover:border-ink"
              >
                Close
              </button>
            </div>
            <Image
              src={mediaUrl(current)}
              alt={current.alt}
              width={current.width}
              height={current.height}
              quality={90}
              className="h-auto max-h-(--viewer-max) w-auto object-contain"
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
