'use client';

// "use client" because the button reports the outcome of a server action in a
// live region. Nothing about the price is computed here — the action takes a
// product id, a variant id and a quantity, and that is all the browser may assert.

import { useState, useTransition } from 'react';

import { addToCart } from '@/features/cart/actions';
import { Button, ButtonLink } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { leadTimeSentence } from '@/lib/catalog/dimensions';
import { PAYMENT_LINE, SHOWROOM } from '@/lib/site';
import { useVariant } from './variant-context';

export function AddToCart({
  productId,
  basePriceMinor,
  currency,
  leadTimeDays,
  productStockQty,
}: {
  productId: string;
  basePriceMinor: string | null;
  currency: string;
  leadTimeDays: number;
  productStockQty: number | null;
}) {
  const { selected } = useVariant();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Integer arithmetic only. The formatted string never re-enters a calculation.
  const unitMinor =
    basePriceMinor === null
      ? null
      : (BigInt(basePriceMinor) + BigInt(selected?.priceDeltaMinor ?? '0')).toString();

  const stockQty = selected ? selected.stockQty : productStockQty;
  const unavailable = stockQty === 0;

  function onClick() {
    startTransition(async () => {
      const result = await addToCart(productId, selected?.id ?? null, 1);
      setMessage(result.message);
    });
  }

  // No settled price yet: ask the shopper to call rather than putting an
  // unpriced line into a cart. The action changes with it — a button labelled
  // "Add to cart" that cannot produce a total would be a lie about what happens
  // next.
  if (unitMinor === null) {
    return (
      <div className="border-t border-rule pt-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            data-testid="unit-price"
            className="font-mono text-step-4 text-accent"
          >
            Ask price
          </span>
          <p className="font-mono text-step--1 text-ink-muted">
            {leadTimeSentence(leadTimeDays, stockQty)}
          </p>
        </div>

        <p className="mt-3 max-w-(--measure) text-step-0 text-ink-muted">
          This piece is priced on request — the cost depends on the size and the
          timber you choose. Call the showroom and we will quote it while you are on
          the phone.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ButtonLink href={`tel:${SHOWROOM.telephone}`} size="lg">
            Call {SHOWROOM.telephoneDisplay}
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary" size="lg">
            Send a message
          </ButtonLink>
        </div>

        <p className="mt-3 font-mono text-step--1 text-ink-muted">
          {PAYMENT_LINE} Delivered in Nairobi and upcountry.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-rule pt-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Price
          minor={unitMinor}
          currency={currency}
          emphasis
          className="text-step-4"
          data-testid="unit-price"
        />
        <p className="font-mono text-step--1 text-ink-muted">
          {leadTimeSentence(leadTimeDays, stockQty)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={onClick} disabled={pending || unavailable}>
          {unavailable ? 'Unavailable' : pending ? 'Adding…' : 'Add to cart'}
        </Button>
        <p className="font-mono text-step--1 text-ink-muted">
          {PAYMENT_LINE} Delivered in Nairobi and upcountry.
        </p>
      </div>

      {/* The action keeps its name: "Add to cart" produces "Added to cart." */}
      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-step-0 text-ink">
        {message}
      </p>
    </div>
  );
}
