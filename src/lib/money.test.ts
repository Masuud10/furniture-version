import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  addMinor,
  compareMinor,
  formatMoney,
  multiplyMinor,
  parseMajorInput,
  serializeMinor,
  subtractMinor,
  sumMinor,
  toMajorInput,
  toMinor,
} from './money';

describe('toMinor', () => {
  it('accepts the shapes money actually arrives in', () => {
    expect(toMinor(4500000n)).toBe(4500000n);
    expect(toMinor(4500000)).toBe(4500000n);
    expect(toMinor('4500000')).toBe(4500000n);
    expect(toMinor('-4500000')).toBe(-4500000n);
  });

  it('rejects a number that has already lost precision', () => {
    expect(() => toMinor(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });

  it('rejects a fractional number, because minor units are exact', () => {
    expect(() => toMinor(4500000.5)).toThrow(MoneyError);
  });

  it('rejects a decimal string, which is a major-unit value in disguise', () => {
    expect(() => toMinor('45000.00')).toThrow(MoneyError);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => toMinor(Number.NaN)).toThrow(MoneyError);
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe('arithmetic', () => {
  it('adds without drift', () => {
    // 0.1 + 0.2 in cents. The float version of this is the reason the file exists.
    expect(addMinor(10, 20)).toBe(30n);
    expect(sumMinor(['1999', 1999, 1999n])).toBe(5997n);
  });

  it('sums an empty basket to zero', () => {
    expect(sumMinor([])).toBe(0n);
  });

  it('subtracts', () => {
    expect(subtractMinor(4500000, 500000)).toBe(4000000n);
  });

  it('multiplies by a whole quantity exactly', () => {
    expect(multiplyMinor(3333, 3)).toBe(9999n);
    expect(multiplyMinor(4500000n, 0)).toBe(0n);
  });

  it('refuses a fractional or negative quantity', () => {
    expect(() => multiplyMinor(100, 1.5)).toThrow(MoneyError);
    expect(() => multiplyMinor(100, -1)).toThrow(MoneyError);
  });

  it('stays exact well past the float safe range', () => {
    const huge = 9007199254740993n; // 2^53 + 1
    expect(addMinor(huge, 1n)).toBe(9007199254740994n);
  });

  it('compares', () => {
    expect(compareMinor(100, 200)).toBe(-1);
    expect(compareMinor(200, 100)).toBe(1);
    expect(compareMinor('100', 100n)).toBe(0);
  });
});

describe('the wire', () => {
  it('serializes to a string, never a number', () => {
    const wire = serializeMinor(4500000n);
    expect(wire).toBe('4500000');
    expect(JSON.parse(JSON.stringify({ total: wire })).total).toBe('4500000');
  });
});

describe('parseMajorInput', () => {
  it('reads what an admin types', () => {
    expect(parseMajorInput('45000')).toBe(4500000n);
    expect(parseMajorInput('45,000')).toBe(4500000n);
    expect(parseMajorInput(' 45000.50 ')).toBe(4500050n);
    expect(parseMajorInput('45000.5')).toBe(4500050n);
    expect(parseMajorInput('0.01')).toBe(1n);
    expect(parseMajorInput('.5')).toBe(50n);
    expect(parseMajorInput('-12.34')).toBe(-1234n);
  });

  it('never routes through a float', () => {
    // 0.1 * 100 is 10.000000000000002 in float. It must not be here.
    expect(parseMajorInput('0.1')).toBe(10n);
    expect(parseMajorInput('1.15')).toBe(115n);
    expect(parseMajorInput('8.29')).toBe(829n);
  });

  it('rejects more than two decimal places rather than rounding silently', () => {
    expect(() => parseMajorInput('45000.555')).toThrow(MoneyError);
  });

  it('rejects nonsense with a sentence a person can act on', () => {
    expect(() => parseMajorInput('')).toThrow(/Enter an amount/);
    expect(() => parseMajorInput('abc')).toThrow(/not an amount/);
    expect(() => parseMajorInput('12.3.4')).toThrow(MoneyError);
  });

  it('round-trips with toMajorInput', () => {
    for (const value of ['45000.00', '0.01', '1.15', '999999.99', '-12.34']) {
      expect(toMajorInput(parseMajorInput(value))).toBe(value);
    }
  });
});

describe('formatMoney', () => {
  const digits = (value: string) => value.replace(/[^\d.,-]/g, '');

  it('drops empty cents by default, because furniture prices are whole', () => {
    expect(digits(formatMoney(4500000n))).toBe('45,000');
  });

  it('keeps cents when there are cents', () => {
    expect(digits(formatMoney(4500050n))).toBe('45,000.50');
  });

  it('keeps empty cents when asked', () => {
    expect(digits(formatMoney(4500000n, { hideZeroCents: false }))).toBe('45,000.00');
  });

  it('formats zero and negatives', () => {
    expect(digits(formatMoney(0n))).toBe('0');
    expect(digits(formatMoney(-4500000n))).toBe('-45,000');
  });

  it('names the currency', () => {
    // Node's ICU renders KES in en-KE as "Ksh". Asserted, not assumed.
    expect(formatMoney(4500000n)).toMatch(/Ksh|KSh|KES/i);
    expect(formatMoney(4500000n, { locale: 'en-US' })).toMatch(/KES/);
  });
});
