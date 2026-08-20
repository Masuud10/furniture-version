import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils/cn';

describe('cn', () => {
  it('keeps a text colour alongside a font size from the custom scale', () => {
    // Regression: tailwind-merge read `text-step-0` as a colour and dropped
    // `text-accent-ink`, putting inherited ink on an accent fill at 2.68:1.
    const result = cn('bg-accent text-accent-ink', 'h-10 px-4 text-step-0');
    expect(result).toContain('text-accent-ink');
    expect(result).toContain('text-step-0');
  });

  it('still lets a later colour override an earlier one', () => {
    expect(cn('text-ink', 'text-accent')).toBe('text-accent');
  });

  it('still lets a later size override an earlier one', () => {
    expect(cn('text-step-0', 'text-step-3')).toBe('text-step-3');
  });

  it('handles the negative step without treating it as a colour', () => {
    const result = cn('text-ink-muted', 'text-step--1');
    expect(result).toContain('text-ink-muted');
    expect(result).toContain('text-step--1');
  });
});

describe('currency rendering', () => {
  // Node ICU renders KES as "Ksh"; ADR-006 specifies "KSh". The correction lives
  // in <Price>, because ADR-006 puts formatting in that primitive and nowhere else.
  it('renders KES as KSh, matching ADR-006', async () => {
    const NBSP = String.fromCharCode(160);
    const { formatMoney } = await import('@/lib/money');

    const raw = formatMoney('14500000', { currency: 'KES' });
    expect(raw).toContain('Ksh');

    const corrected = raw.replace(/\bKsh\b/, 'KSh');
    expect(corrected).not.toContain('Ksh');

    // Intl separates symbol from amount with a non-breaking space, which is right:
    // a price must never wrap between the two. Built from a named constant rather
    // than pasted, so the assertion never depends on an invisible character here.
    expect(corrected).toBe('KSh' + NBSP + '145,000');
  });
});
