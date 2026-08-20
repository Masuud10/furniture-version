import type { ComponentProps } from 'react';

import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

/**
 * Node's ICU renders KES as "Ksh". ADR-006 specifies "KSh 45,000.00".
 *
 * The fix belongs here and not in `money.ts`: ADR-006 puts formatting in the
 * <Price> primitive "and nowhere else", so the currency symbol is a presentation
 * concern. Scoped to the standalone token so it can never touch a digit or a
 * word inside product copy.
 */
function kenyanShilling(formatted: string): string {
  return formatted.replace(/\bKsh\b/, 'KSh');
}

/**
 * The only place a money value is formatted (ADR-006).
 *
 * Takes minor units as a string, because that is how money crosses the wire —
 * a `number` loses precision above 2^53 and a `bigint` does not survive
 * JSON.stringify. There is no arithmetic here.
 */
export function Price({
  minor,
  currency,
  className,
  emphasis = false,
  ...rest
}: {
  minor: string;
  currency: string;
  className?: string;
  /** Price emphasis is one of the three jobs the accent colour is allowed. */
  emphasis?: boolean;
} & Omit<ComponentProps<'span'>, 'children'>) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums tracking-normal',
        emphasis ? 'text-accent' : 'text-ink',
        className,
      )}
      {...rest}
    >
      {kenyanShilling(formatMoney(minor, { currency }))}
    </span>
  );
}

/** A price difference on a variant swatch: "+ KSh 4,200" or "included". */
export function PriceDelta({ minor, currency }: { minor: string; currency: string }) {
  const value = BigInt(minor);
  if (value === 0n) {
    return <span className="font-mono text-step--1 text-ink-muted">included</span>;
  }
  const sign = value > 0n ? '+' : '−';
  const magnitude = value < 0n ? -value : value;
  return (
    <span className="font-mono text-step--1 tabular-nums text-ink-muted">
      {sign} {kenyanShilling(formatMoney(magnitude.toString(), { currency }))}
    </span>
  );
}
