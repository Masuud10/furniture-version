/**
 * Money.
 *
 * Amounts are integer minor units (KES cents) held as `bigint`. There is no
 * float anywhere in this file and there must never be one, because the whole
 * point of the type is to make the unsafe operation impossible rather than
 * merely discouraged.
 *
 * Boundary rules:
 *   - Postgres `bigint` arrives over PostgREST as a JSON number. That is safe
 *     for the magnitudes this shop deals in, and it is still checked, because
 *     "safe today" is how precision bugs get in.
 *   - Money leaves the server as a string. `bigint` does not survive
 *     JSON.stringify, and a `number` is exactly the thing being avoided.
 *   - Formatting happens in the <Price> primitive and nowhere else.
 */

export const MINOR_UNITS_PER_MAJOR = 100n;

/** Anything that can legitimately arrive at a money boundary. */
export type MoneyInput = bigint | number | string;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Coerce a value from the database, an env var or a form into minor units.
 * Rejects anything that is not an exact integer — including a `number` that has
 * already lost precision before it reached us.
 */
export function toMinor(value: MoneyInput): bigint {
  if (typeof value === 'bigint') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MoneyError(`Not a finite amount: ${value}`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError(
        `Amount ${value} is not a safe integer. Minor units must be exact; ` +
          `this value either has a fractional part or exceeds 2^53.`,
      );
    }
    return BigInt(value);
  }

  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new MoneyError(`Not an integer minor-unit string: "${value}"`);
  }
  return BigInt(trimmed);
}

/** Money crossing the wire. Always a string. */
export function serializeMinor(minor: bigint): string {
  return minor.toString();
}

export function addMinor(...amounts: MoneyInput[]): bigint {
  return amounts.reduce<bigint>((total, amount) => total + toMinor(amount), 0n);
}

export function subtractMinor(a: MoneyInput, b: MoneyInput): bigint {
  return toMinor(a) - toMinor(b);
}

/**
 * Line total. Quantity is a whole number of items, so this is exact — there is
 * no rounding step and there must never be one.
 */
export function multiplyMinor(unit: MoneyInput, quantity: number): bigint {
  if (!Number.isSafeInteger(quantity)) {
    throw new MoneyError(`Quantity must be a whole number, got ${quantity}`);
  }
  if (quantity < 0) {
    throw new MoneyError(`Quantity must not be negative, got ${quantity}`);
  }
  return toMinor(unit) * BigInt(quantity);
}

export function sumMinor(amounts: readonly MoneyInput[]): bigint {
  return addMinor(...amounts);
}

export function isZero(amount: MoneyInput): boolean {
  return toMinor(amount) === 0n;
}

export function compareMinor(a: MoneyInput, b: MoneyInput): -1 | 0 | 1 {
  const left = toMinor(a);
  const right = toMinor(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Parse what a human types into a price field: "45,000", "45000.50", "45 000,50"
 * is not supported on purpose — one locale, one decimal separator, stated in the
 * field hint. Returns minor units without ever constructing a float.
 */
export function parseMajorInput(input: string): bigint {
  const cleaned = input.trim().replace(/[\s,]/g, '');
  if (cleaned === '') {
    throw new MoneyError('Enter an amount.');
  }

  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new MoneyError(`"${input}" is not an amount. Use digits, for example 45000.50`);
  }

  const [, sign, wholePart = '', fractionPart = ''] = match;
  if (fractionPart.length > 2) {
    throw new MoneyError('Amounts have at most two decimal places.');
  }

  const whole = BigInt(wholePart === '' ? '0' : wholePart);
  const fraction = BigInt(fractionPart.padEnd(2, '0') || '0');
  const total = whole * MINOR_UNITS_PER_MAJOR + fraction;

  return sign === '-' ? -total : total;
}

/** The inverse of `parseMajorInput`, for populating an edit field. */
export function toMajorInput(amount: MoneyInput): string {
  const minor = toMinor(amount);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / MINOR_UNITS_PER_MAJOR;
  const fraction = absolute % MINOR_UNITS_PER_MAJOR;
  const body = `${whole}.${fraction.toString().padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}

export interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  /**
   * Furniture prices are whole shillings in practice. When the amount has no
   * cents, "KSh 45,000" reads better than "KSh 45,000.00".
   */
  hideZeroCents?: boolean;
}

export const DEFAULT_CURRENCY = 'KES';
export const DEFAULT_LOCALE = 'en-KE';

/**
 * Only <Price> should call this. Everything else passes minor units around.
 *
 * The division into major/minor happens in integer space; the float only exists
 * for the last step, inside Intl, where the value is already at most two decimal
 * places and well inside the safe range.
 */
export function formatMoney(amount: MoneyInput, options: FormatMoneyOptions = {}): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    hideZeroCents = true,
  } = options;

  const minor = toMinor(amount);
  const hasCents = minor % MINOR_UNITS_PER_MAJOR !== 0n;
  const digits = hideZeroCents && !hasCents ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(toMajorInput(minor)));
}
