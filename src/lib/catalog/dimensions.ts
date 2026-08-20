import type { Dimensions } from './types';

/**
 * Dimensions are stored in millimetres because that is how furniture is drawn and
 * how a workshop cuts. They are shown in millimetres for the same reason, and
 * converted to centimetres only for schema.org, which wants CMT.
 */

export function formatMm(value: number): string {
  return `${value} mm`;
}

/** "2100 × 900 × 780 mm" — the string a buyer reads aloud down the phone. */
export function formatWdh(d: Dimensions): string {
  return `${d.w} × ${d.d} × ${d.h} mm`;
}

export function toCm(mm: number): number {
  return mm / 10;
}

/** Lead time, stated plainly. Never a badge, never "ships soon". */
export function leadTimeSentence(leadTimeDays: number, stockQty: number | null): string {
  if (stockQty === null) {
    return `Made to order — ready in ${leadTimeDays} days.`;
  }
  if (stockQty > 0) {
    return `In stock — delivered in ${leadTimeDays} days.`;
  }
  return 'Not available to order at the moment.';
}

export function availabilityLabel(stockQty: number | null): 'made-to-order' | 'in-stock' | 'unavailable' {
  if (stockQty === null) return 'made-to-order';
  return stockQty > 0 ? 'in-stock' : 'unavailable';
}
