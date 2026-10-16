import { expect, test } from '@playwright/test';

const order = {
  _id: '10339', orderId: 10339, customerName: 'Bikram Paul', customerEmail: 'bikram@example.com',
  items: [{ name: 'Tulsi Kanthi Mala Two Round', sku: 'TMK-21', price: 100, quantity: 1 }],
  total: 159, status: 'shipped', paymentMethod: 'UPI', shippingService: 'DTDC', trackingId: 'AWB10339',
  shippingAddress: { fullName: 'Bikram Paul', street: 'Temple Road', city: 'Mathura', state: 'Uttar Pradesh', pincode: '281001', mobile: '9876543210' },
  createdAt: '2026-10-14T08:00:00Z', statusHistory: [],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('brajmart-admin', JSON.stringify({
    state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' }, version: 0,
  })));
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/orders') return route.fulfill({ json: [order] });
    if (url.pathname === '/api/orders/10339/invoice') return route.fulfill({
      status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nTest invoice\n%%EOF'),
    });
    if (url.pathname === '/api/orders/admin/invoices.zip') return route.fulfill({
      status: 200, contentType: 'application/zip', body: Buffer.from('PK\u0003\u0004Test ZIP'),
    });
    return route.fulfill({ json: url.pathname === '/api/products' ? [] : {} });
  });
});

test('individual invoice downloads directly as a PDF without a print tab', async ({ page }) => {
  await page.goto('/admin/orders');
  const pageCount = page.context().pages().length;
  const downloadEvent = page.waitForEvent('download');
  const requestEvent = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders/10339/invoice');
  await page.getByRole('button', { name: 'Download PDF invoice for order 10339' }).click();
  const [download, request] = await Promise.all([downloadEvent, requestEvent]);
  expect(download.suggestedFilename()).toBe('BrajMart-Invoice-10339.pdf');
  expect(new URL(request.url()).searchParams.get('download')).toBe('1');
  expect(request.headers().authorization).toBe('Bearer test-admin-token');
  expect(await download.failure()).toBeNull();
  expect(page.context().pages()).toHaveLength(pageCount);
  await expect(page.getByText('Invoice PDF downloaded')).toBeVisible();
});

test('all-invoices button downloads one ZIP across all orders even when table filters are active', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/orders');
  await page.getByPlaceholder('Search by Order ID or Customer...').fill('no matching customer');
  const requestEvent = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders/admin/invoices.zip');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download All Invoices (ZIP)' }).click();
  const [download, request] = await Promise.all([downloadEvent, requestEvent]);
  expect(download.suggestedFilename()).toBe('BrajMart-All-Invoices.zip');
  expect(new URL(request.url()).search).toBe('');
  expect(request.headers().authorization).toBe('Bearer test-admin-token');
  expect(await download.failure()).toBeNull();
  await expect(page.getByText('All invoice PDFs downloaded in one ZIP')).toBeVisible();
  await page.getByPlaceholder('Search by Order ID or Customer...').fill('');
  await page.screenshot({ path: 'test-results/admin-invoice-downloads.png', fullPage: true });
});

test('invoice batch errors remain visible and the button can be retried', async ({ page }) => {
  await page.route('**/api/orders/admin/invoices.zip', (route) => route.fulfill({
    status: 503, json: { message: 'Database unavailable' },
  }));
  await page.goto('/admin/orders');
  const button = page.getByRole('button', { name: 'Download All Invoices (ZIP)' });
  await button.click();
  await expect(page.getByText('Database unavailable')).toBeVisible();
  await expect(button).toBeEnabled();
});

test('batch invoice button fits a narrow admin viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/orders');
  const button = page.getByRole('button', { name: 'Download All Invoices (ZIP)' });
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
