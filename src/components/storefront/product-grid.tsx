import type { ProductCardModel } from '@/lib/catalog/types';
import { ProductCard } from './product-card';

/**
 * `sizes` is the single most important attribute on this page. At 1440px a card
 * is a quarter of a 1440px container, so ~336px — not 1440px. Getting this wrong
 * ships a 1600px file to a phone and is the usual reason an image grid has a slow
 * LCP.
 */
const GRID_SIZES = '(min-width: 64rem) 23vw, (min-width: 48rem) 31vw, (min-width: 30rem) 47vw, 92vw';

export function ProductGrid({
  products,
  /** The first row is above the fold; only its first card gets priority. */
  priorityCount = 0,
}: {
  products: readonly ProductCardModel[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <li key={product.id}>
          <ProductCard product={product} priority={i < priorityCount} sizes={GRID_SIZES} />
        </li>
      ))}
    </ul>
  );
}
