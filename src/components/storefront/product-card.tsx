import Link from 'next/link';

import { availabilityLabel } from '@/lib/catalog/dimensions';
import type { ProductCardModel } from '@/lib/catalog/types';
import { Media, MediaPlaceholder } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { cn } from '@/lib/utils/cn';
import { DimensionFigure, DimensionStrip } from './dimension-figure';

/**
 * A grid card. The whole card is not a link — the title is, so a screen reader
 * announces one meaningful link rather than a link containing an image, a price
 * and a paragraph. The dimension toggle sits outside that link on purpose.
 */
export function ProductCard({
  product,
  priority = false,
  sizes,
}: {
  product: ProductCardModel;
  /** True only for the first card above the fold on a listing. */
  priority?: boolean;
  sizes: string;
}) {
  const availability = availabilityLabel(product.stockQty);

  return (
    <article className="group flex flex-col border-t border-rule pt-4">
      {product.primaryImage ? (
        <DimensionFigure
          dimensions={product.dimensions}
          anchors={product.primaryImage.anchors}
          axes="wd"
          className="mb-4"
        >
          <Media
            asset={product.primaryImage}
            sizes={sizes}
            priority={priority}
            className="border border-rule"
          />
        </DimensionFigure>
      ) : (
        <MediaPlaceholder className="mb-4" />
      )}

      <h3 className="text-step-1 font-semibold">
        <Link
          href={`/products/${product.slug}`}
          className="underline-offset-4 hover:underline focus-visible:underline"
        >
          {product.name}
        </Link>
      </h3>

      <p className="mt-1 font-mono text-step--1 uppercase tracking-wide text-ink-muted">
        {product.sku}
      </p>

      <DimensionStrip dimensions={product.dimensions} className="mt-2" />

      <div className="mt-3 flex items-baseline justify-between gap-3">
        {product.basePriceMinor === null ? (
          <span className="font-mono text-accent">Ask price</span>
        ) : (
          <Price minor={product.basePriceMinor} currency={product.currency} emphasis />
        )}
        <span
          className={cn(
            'font-mono text-step--1',
            availability === 'unavailable' ? 'text-ink-muted' : 'text-ink-muted',
          )}
        >
          {availability === 'made-to-order' && `${product.leadTimeDays} days`}
          {availability === 'in-stock' && 'In stock'}
          {availability === 'unavailable' && 'Unavailable'}
        </span>
      </div>
    </article>
  );
}
