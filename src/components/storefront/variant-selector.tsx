'use client';

// "use client" because selecting a finish changes the price, the gallery and the
// URL. It is a radiogroup rather than a listbox: one choice out of a small set,
// all of them visible.

import { PriceDelta } from '@/components/ui/price';
import { cn } from '@/lib/utils/cn';
import { useVariant } from './variant-context';

/**
 * Material swatches are first-class UI, not colour chips in a dropdown: a labelled
 * square with the material name in mono beneath it. The name carries the meaning —
 * the colour never does the work alone, which is both the design brief and the
 * accessibility floor.
 *
 * Selected state is a double rule, not a glow.
 */
export function VariantSelector({ currency }: { currency: string }) {
  const { variants, selected, select } = useVariant();

  if (variants.length <= 1) return null;

  const isSize = variants.every((v) => v.kind === 'size');
  const legend = isSize ? 'Size' : 'Finish';

  return (
    <fieldset>
      <legend className="font-mono text-step--1 uppercase tracking-wide text-ink-muted">
        {legend}
      </legend>

      <div role="radiogroup" aria-label={legend} className="mt-3 flex flex-wrap gap-3">
        {variants.map((variant) => {
          const isSelected = selected?.id === variant.id;
          const unavailable = variant.stockQty === 0;

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => select(variant.id)}
              className={cn(
                'flex w-28 flex-col gap-2 border p-2 text-left transition-colors',
                isSelected
                  ? 'border-accent outline outline-1 outline-offset-2 outline-accent'
                  : 'border-rule hover:border-rule-strong',
                unavailable && 'opacity-60',
              )}
            >
              {variant.kind === 'finish' && (
                <span
                  aria-hidden="true"
                  className="block h-10 w-full border border-rule"
                  style={variant.swatchHex ? { backgroundColor: variant.swatchHex } : undefined}
                />
              )}
              <span className="font-mono text-step--1 leading-snug text-ink">{variant.name}</span>
              <PriceDelta minor={variant.priceDeltaMinor} currency={currency} />
              {unavailable && (
                <span className="font-mono text-step--1 text-ink-muted">Unavailable</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
