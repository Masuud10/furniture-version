'use client';

// "use client" because the touch affordance needs real pressed state. Hover and
// keyboard focus are handled in CSS (`:hover`, `:focus-within` in globals.css),
// so this ships one small toggle and nothing else. The image itself is passed in
// as `children` and stays server-rendered.

import { useId, useState, type ReactNode } from 'react';

import { formatMm } from '@/lib/catalog/dimensions';
import type { Dimensions, MediaAnchors } from '@/lib/catalog/types';
import { cn } from '@/lib/utils/cn';

/**
 * The signature element.
 *
 * Hairline extension lines run to the edges of the piece, a dimension line spans
 * between them, and the measurement sits on a small opaque plate in mono. The
 * geometry is `anchors` — the measured bounding box of the piece inside the frame,
 * stored per image — crossed with `dimensions` from the product. Nothing here is
 * hand-placed, which is the difference between a drawing and a decoration.
 *
 * `axes` is 'wd' on a listing card and 'wdh' on product detail.
 *
 * Everything is absolutely positioned inside a container that already has its
 * aspect ratio, so the annotations cannot shift the page when they appear.
 */
export function DimensionFigure({
  children,
  dimensions,
  anchors,
  axes = 'wd',
  className,
}: {
  children: ReactNode;
  dimensions: Dimensions | null;
  anchors: MediaAnchors | null;
  axes?: 'wd' | 'wdh';
  className?: string;
}) {
  const [pinned, setPinned] = useState(false);
  const labelId = useId();

  // Without anchors, or without measurements, there is no geometry to draw
  // against — so draw nothing rather than guess.
  if (!anchors || !dimensions) {
    return <div className={className}>{children}</div>;
  }

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

  const left = anchors.x1;
  const right = anchors.x2;
  const top = anchors.y1;
  const bottom = anchors.y2;

  // Put the dimension lines roughly halfway into the empty margin, which is where
  // a draughtsman would put them.
  const widthLineY = bottom + (1 - bottom) * 0.42;
  const heightLineX = right + (1 - right) * 0.45;

  return (
    <div
      className={cn('dimension-figure', className)}
      data-annotated={pinned ? 'true' : 'false'}
    >
      {children}

      <div className="dimension-layer" aria-hidden="true">
        {/* Width ------------------------------------------------------------ */}
        <span
          className="dim-line-v absolute border-l border-ink/45"
          style={{ left: pct(left), top: pct(bottom), height: pct(widthLineY - bottom) }}
        />
        <span
          className="dim-line-v absolute border-l border-ink/45"
          style={{ left: pct(right), top: pct(bottom), height: pct(widthLineY - bottom) }}
        />
        <span
          className="dim-line-h absolute border-t border-ink"
          style={{ left: pct(left), top: pct(widthLineY), width: pct(right - left) }}
        />
        <Plate style={{ left: pct((left + right) / 2), top: pct(widthLineY) }}>
          {formatMm(dimensions.w)}
        </Plate>

        {/* Height ----------------------------------------------------------- */}
        {axes === 'wdh' && (
          <>
            <span
              className="dim-line-h absolute border-t border-ink/45"
              style={{ left: pct(right), top: pct(top), width: pct(heightLineX - right) }}
            />
            <span
              className="dim-line-h absolute border-t border-ink/45"
              style={{ left: pct(right), top: pct(bottom), width: pct(heightLineX - right) }}
            />
            <span
              className="dim-line-v absolute border-l border-ink"
              style={{ left: pct(heightLineX), top: pct(top), height: pct(bottom - top) }}
            />
            <Plate style={{ left: pct(heightLineX), top: pct((top + bottom) / 2) }}>
              {formatMm(dimensions.h)}
            </Plate>
          </>
        )}

        {/* Depth — no extent in a front elevation, so it is a leader and a plate. */}
        <span
          className="dim-line-h absolute border-t border-ink/45"
          style={{ left: pct(left), top: pct(top * 0.55), width: pct((right - left) * 0.18) }}
        />
        <Plate style={{ left: pct(left + (right - left) * 0.18), top: pct(top * 0.55) }} align="start">
          d {formatMm(dimensions.d)}
        </Plate>
      </div>

      {/* Touch affordance. It is its own control, so tapping it never steals the
          tap that opens the product. */}
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        aria-pressed={pinned}
        aria-describedby={labelId}
        className={cn(
          'dimension-toggle absolute bottom-2 right-2 z-10 flex h-8 items-center gap-1 rounded-sm border px-2',
          'font-mono text-step--1 transition-colors',
          pinned
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-rule-strong bg-surface-raised/90 text-ink-muted hover:text-ink',
        )}
      >
        <span aria-hidden="true">↔</span>
        <span id={labelId}>{pinned ? 'Hide sizes' : 'Sizes'}</span>
      </button>
    </div>
  );
}

function Plate({
  children,
  style,
  align = 'center',
}: {
  children: ReactNode;
  style: React.CSSProperties;
  align?: 'center' | 'start';
}) {
  return (
    <span
      className={cn(
        'absolute whitespace-nowrap border border-rule-strong bg-surface-raised px-1 py-px',
        'font-mono text-step--1 tabular-nums leading-snug text-ink',
        align === 'center' ? '-translate-x-1/2 -translate-y-1/2' : '-translate-y-1/2',
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/**
 * Below 480px the annotations would cover the piece, so the figure degrades to
 * this: the same numbers, in the same mono, underneath the image.
 */
export function DimensionStrip({
  dimensions,
  className,
}: {
  dimensions: Dimensions | null;
  className?: string;
}) {
  if (!dimensions) return null;

  return (
    <p
      className={cn(
        'flex flex-wrap gap-x-3 font-mono text-step--1 tabular-nums text-ink-muted',
        className,
      )}
    >
      <span>w {dimensions.w}</span>
      <span>d {dimensions.d}</span>
      <span>h {dimensions.h}</span>
      <span aria-hidden="true">mm</span>
      <span className="sr-only">millimetres</span>
    </p>
  );
}
