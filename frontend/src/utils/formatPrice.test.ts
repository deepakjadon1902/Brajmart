import { describe, expect, it } from 'vitest';
import { formatPrice } from './formatPrice';

describe('formatPrice', () => {
  it.each([
    [123456.5, '₹1,23,456.5'],
    ['123456.5', '₹1,23,456.5'],
    [0, '₹0'],
  ])('formats a known amount %s', (value, expected) => {
    expect(formatPrice(value)).toBe(expected);
  });

  it.each([undefined, null, '', '   ', 'invalid', NaN, Infinity, -Infinity])(
    'shows unavailable for a missing or invalid amount %s',
    (value) => {
      expect(formatPrice(value)).toBe('Not available');
    },
  );
});
