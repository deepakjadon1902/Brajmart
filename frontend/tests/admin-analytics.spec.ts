import { expect, test } from '../playwright-fixture';
import type { AnalyticsOrderSummary, AnalyticsPeriod, AnalyticsReport } from '../src/lib/api';

const factors: Record<AnalyticsPeriod, number> = { daily: 1, weekly: 2, monthly: 3, quarterly: 4, yearly: 5 };
const starts: Record<AnalyticsPeriod, string> = { daily: '2026-11-03T18:30:00Z', weekly: '2026-11-01T18:30:00Z', monthly: '2026-10-31T18:30:00Z', quarterly: '2026-09-30T18:30:00Z', yearly: '2025-12-31T18:30:00Z' };
const labels: Record<AnalyticsPeriod, string> = { daily: '04 Nov 2026', weekly: '02 Nov 2026 - 04 Nov 2026', monthly: '01 Nov 2026 - 04 Nov 2026', quarterly: '01 Oct 2026 - 04 Nov 2026', yearly: '01 Jan 2026 - 04 Nov 2026' };
const periods = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const;

const makeReport = (period: AnalyticsPeriod = 'daily'): AnalyticsReport => {
  const factor = factors[period];
  const summary: AnalyticsOrderSummary = {
    totalOrders: 10 * factor,
    statuses: { confirmed: 2 * factor, processing: factor, shipped: 3 * factor, out_for_delivery: factor, delivered: 2 * factor, rto: 0, cancelled: factor },
    finances: {
      orderValue: 1000 * factor, productValue: 800 * factor, shippingCharges: 60 * factor,
      packagingCharges: 40 * factor, codCharges: 100 * factor, serviceCharges: 200 * factor, discounts: 0,
      collectedRevenue: 700 * factor, onlineCollected: 650 * factor, codCollected: 50 * factor, codOutstanding: 300 * factor,
      collectedOrders: 7 * factor, codOutstandingOrders: 3 * factor,
      missingBreakdown: { productValue: 0, shippingCharges: 1, packagingCharges: 1, codCharges: 1 },
    },
  };
  return {
    period, generatedAt: '2026-11-04T07:00:00Z',
    range: { label: labels[period], start: starts[period], end: '2026-11-04T07:00:00Z' },
    totals: {
      periodRevenue: 700 * factor, previousRevenue: 0, revenueChange: 0, periodOrders: 10 * factor,
      deliveredOrders: 2 * factor, cancelledOrders: factor, averageOrderValue: 70, totalRevenue: 70000,
      paidSalesCount: 110, onlineRevenue: 650 * factor, codRevenue: 50 * factor, completionRate: 20,
    },
    buckets: [], breakdowns: { categories: [], statuses: {}, payments: {} },
    allTime: { ...summary, totalOrders: 158, finances: { ...summary.finances, orderValue: 94829, collectedRevenue: 70000 } },
    periodSummary: summary,
  };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({ state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' }, version: 0 }));
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/analytics') return route.fulfill({ json: makeReport((url.searchParams.get('period') || 'daily') as AnalyticsPeriod) });
    return route.fulfill({ json: {} });
  });
});

test('all five period buttons update statuses, every charge, revenue and the India date range', async ({ page }) => {
  await page.goto('/admin/analytics');
  for (const label of periods) {
    const period = label.toLowerCase() as AnalyticsPeriod;
    const expected = makeReport(period).periodSummary!;
    await page.getByRole('button', { name: label, exact: true }).click();
    const statuses = page.getByRole('region', { name: `${label} Order Status`, exact: true });
    await expect(statuses.getByRole('group', { name: 'Total orders', exact: true }).locator('dd')).toHaveText(String(expected.totalOrders));
    await expect(statuses.getByText(`${labels[period]} · IST`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const [status, count] of [['Confirmed', expected.statuses.confirmed], ['Processing', expected.statuses.processing], ['Shipped', expected.statuses.shipped], ['Out for Delivery', expected.statuses.out_for_delivery], ['Delivered', expected.statuses.delivered], ['RTO', expected.statuses.rto], ['Cancelled', expected.statuses.cancelled]] as const) {
      await expect(statuses.getByRole('group', { name: status, exact: true }).locator('dd')).toHaveText(String(count));
    }
    const finances = page.getByRole('region', { name: `${label} Order Charges & Revenue`, exact: true });
    const amounts = expected.finances;
    for (const [name, amount] of [['Total order value', amounts.orderValue], ['Collected revenue', amounts.collectedRevenue], ['Online collected', amounts.onlineCollected], ['COD collected', amounts.codCollected], ['Products value', amounts.productValue], ['Shipping charges', amounts.shippingCharges], ['Packaging charges', amounts.packagingCharges], ['COD fees', amounts.codCharges], ['COD awaiting collection', amounts.codOutstanding], ['Order discounts', amounts.discounts], ['Total shipping, packaging & COD', amounts.serviceCharges]] as const) {
      await expect(finances.getByRole('group', { name, exact: true }).locator('dd')).toHaveText(`INR ${amount.toLocaleString('en-IN')}`);
    }
    await expect(finances.getByText(/Some older orders have no saved price breakdown/)).toBeVisible();
  }
  await page.getByRole('region', { name: 'Yearly Order Status', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-results/analytics/filtered-status-desktop.png', fullPage: true });
  await page.getByRole('region', { name: 'Yearly Order Charges & Revenue', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-results/analytics/filtered-finances-desktop.png', fullPage: true });
});

test('automatic and manual refresh keep the selected monthly filter', async ({ page }) => {
  await page.clock.install();
  let updated = false;
  await page.route('**/api/analytics?*', (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') as AnalyticsPeriod;
    const report = makeReport(period);
    if (updated) {
      report.periodSummary!.statuses.shipped = 10;
      report.periodSummary!.statuses.confirmed = 5;
      report.periodSummary!.finances.collectedRevenue = 2200;
      report.periodSummary!.finances.codOutstanding = 800;
      report.generatedAt = '2026-11-04T07:00:15Z';
    }
    return route.fulfill({ json: report });
  });
  await page.goto('/admin/analytics');
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  const statuses = page.getByRole('region', { name: 'Monthly Order Status', exact: true });
  const finances = page.getByRole('region', { name: 'Monthly Order Charges & Revenue', exact: true });
  await expect(statuses.getByRole('group', { name: 'Shipped', exact: true }).locator('dd')).toHaveText('9');
  updated = true;
  const automaticRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/analytics');
  await page.clock.fastForward(15_000);
  const request = await automaticRequest;
  expect(request.headers().authorization).toBe('Bearer test-admin-token');
  expect(new URL(request.url()).searchParams.get('period')).toBe('monthly');
  expect(new URL(request.url()).searchParams.get('fresh')).not.toBeNull();
  await expect(statuses.getByRole('group', { name: 'Shipped', exact: true }).locator('dd')).toHaveText('10');
  await expect(finances.getByRole('group', { name: 'Collected revenue', exact: true }).locator('dd')).toHaveText('INR 2,200');
  await expect(finances.getByRole('group', { name: 'COD awaiting collection', exact: true }).locator('dd')).toHaveText('INR 800');
  const manualRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/analytics');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect(new URL((await manualRequest).url()).searchParams.get('period')).toBe('monthly');
});

test('slow responses never replace a newer period or show previous-period totals under a new title', async ({ page }) => {
  await page.clock.install();
  let releaseWeekly!: () => void;
  const weeklyGate = new Promise<void>((resolve) => { releaseWeekly = resolve; });
  await page.route('**/api/analytics?*', async (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') as AnalyticsPeriod;
    if (period === 'weekly') await weeklyGate;
    await route.fulfill({ json: makeReport(period) });
  });
  await page.goto('/admin/analytics');
  await expect(page.getByRole('group', { name: 'Total orders', exact: true }).locator('dd')).toHaveText('10');
  const weeklyRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('period') === 'weekly');
  await page.getByRole('button', { name: 'Weekly', exact: true }).click();
  await weeklyRequest;
  await expect(page.getByRole('region', { name: 'Weekly Order Status', exact: true }).getByRole('group', { name: 'Total orders', exact: true }).locator('dd')).toHaveText('—');
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  const total = page.getByRole('region', { name: 'Monthly Order Status', exact: true }).getByRole('group', { name: 'Total orders', exact: true }).locator('dd');
  await expect(total).toHaveText('30');
  const lateResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('period') === 'weekly');
  releaseWeekly();
  await lateResponse;
  await expect(total).toHaveText('30');
  await expect(page.getByRole('region', { name: 'Weekly Order Status', exact: true })).toHaveCount(0);
});

test('keeps the last successful report visible during an outage and recovers automatically', async ({ page }) => {
  await page.clock.install();
  let fail = false;
  await page.route('**/api/analytics?*', (route) => fail
    ? route.fulfill({ status: 503, json: { message: 'Database unavailable' } })
    : route.fulfill({ json: makeReport() }));
  await page.goto('/admin/analytics');
  const total = page.getByRole('group', { name: 'Total orders', exact: true }).locator('dd');
  await expect(total).toHaveText('10');
  fail = true;
  await page.clock.fastForward(15_000);
  await expect(page.getByRole('alert')).toContainText('Showing the last successful report.');
  await expect(total).toHaveText('10');
  fail = false;
  await page.clock.fastForward(15_000);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an empty selected period shows zeros even when all-time totals are nonzero', async ({ page }) => {
  const report = makeReport();
  report.periodSummary!.totalOrders = 0;
  for (const key of Object.keys(report.periodSummary!.statuses)) report.periodSummary!.statuses[key] = 0;
  const finance = report.periodSummary!.finances;
  for (const key of Object.keys(finance)) {
    if (key !== 'missingBreakdown') (finance as unknown as Record<string, unknown>)[key] = 0;
  }
  finance.missingBreakdown = { productValue: 0, shippingCharges: 0, packagingCharges: 0, codCharges: 0 };
  await page.route('**/api/analytics?*', (route) => route.fulfill({ json: report }));
  await page.goto('/admin/analytics');
  await expect(page.getByRole('group', { name: 'Total orders', exact: true }).locator('dd')).toHaveText('0');
  await expect(page.getByRole('group', { name: 'Collected revenue', exact: true }).locator('dd')).toHaveText('INR 0');
  await expect(page.getByText(/Some older orders have no saved price breakdown/)).toHaveCount(0);
});

test('filtered sections and their date ranges fit a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/analytics');
  await page.getByRole('button', { name: 'Quarterly', exact: true }).click();
  const statuses = page.getByRole('region', { name: 'Quarterly Order Status', exact: true });
  const finances = page.getByRole('region', { name: 'Quarterly Order Charges & Revenue', exact: true });
  await expect(statuses.getByRole('group', { name: 'Total orders', exact: true }).locator('dd')).toHaveText('40');
  for (const section of [statuses, finances]) {
    const bounds = await section.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await statuses.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-results/analytics/filtered-status-mobile.png', fullPage: true });
  await finances.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.test-results/analytics/filtered-finances-mobile.png', fullPage: true });
});
