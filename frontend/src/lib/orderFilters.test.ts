import { describe, expect, it } from 'vitest';
import { orderDateKey, orderDateRange } from './orderFilters';
import { isInvoiceFilename } from './invoiceFilenames';

describe('order dates in India', () => {
  it('uses the India date when UTC is still on the previous day', () => {
    const now = new Date('2026-10-31T19:00:00Z');
    expect(orderDateKey(now)).toBe('2026-11-01');
    expect(orderDateRange('today', now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-01' });
    expect(orderDateRange('month', now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-01' });
  });

  it('includes today in rolling ranges across month and year boundaries', () => {
    const now = new Date('2026-01-03T08:00:00Z');
    expect(orderDateRange('last7', now)).toEqual({ dateFrom: '2025-12-28', dateTo: '2026-01-03' });
    expect(orderDateRange('last30', now)).toEqual({ dateFrom: '2025-12-05', dateTo: '2026-01-03' });
    expect(orderDateRange('all', now)).toEqual({ dateFrom: '', dateTo: '' });
  });

  it('accepts customer and order date filenames while rejecting unsafe paths', () => {
    expect(isInvoiceFilename('Bikram Paul - 2026-10-14 - Invoice-10339.pdf', '10339')).toBe(true);
    expect(isInvoiceFilename('../Bikram Paul - 2026-10-14 - Invoice-10339.pdf', '10339')).toBe(false);
  });
});
