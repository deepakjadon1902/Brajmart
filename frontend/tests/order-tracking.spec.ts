import { expect, test, type Page } from '../playwright-fixture';

// Match the public tracking API: amounts and customer addresses are omitted.
const publicOrder = {
  orderId: 10339,
  status: 'shipped',
  createdAt: '2026-10-26T08:00:00Z',
  trackingId: 'AWB10339',
  shippingService: 'DTDC',
  paymentMethod: 'UPI',
  items: [{ productId: '21', name: 'Tulsi Kanthi Mala', image: '/placeholder.svg', quantity: 2 }],
  statusHistory: [{ status: 'shipped', date: '2026-10-27T08:00:00Z', note: 'Order dispatched' }],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/products' || path === '/api/categories' ? [] : {} });
  });
});

async function search(page: Page, lookup: string) {
  await page.getByPlaceholder('Enter order ID or tracking ID').fill(lookup);
  await page.getByRole('button', { name: 'Track order', exact: true }).click();
}

async function expectPublicOrder(page: Page) {
  await expect(page.getByRole('heading', { name: '#AWB10339' })).toBeVisible();
  await expect(page.getByText('Tulsi Kanthi Mala', { exact: true })).toBeVisible();
  await expect(page.getByText('Order dispatched', { exact: true })).toBeVisible();
  await expect(page.getByText('Payment details are available in your order confirmation.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  await expect(page.getByText(/₹0|₹NaN/)).toHaveCount(0);
}

test('tracks an AWB without payment amounts on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/orders/track-by-id/AWB10339', (route) => route.fulfill({ json: publicOrder }));
  await page.goto('/track-orders');
  await search(page, 'AWB10339');
  await expectPublicOrder(page);
});

test('tracks a numeric order ID through the public order lookup', async ({ page }) => {
  await page.route('**/api/orders/track-by-id/10339', (route) => route.fulfill({ status: 404, json: { message: 'Order not found' } }));
  await page.route('**/api/orders/track/10339', (route) => route.fulfill({ json: publicOrder }));
  await page.goto('/track-order?orderId=10339');
  await expect(page.getByPlaceholder('Enter order ID or tracking ID')).toHaveValue('10339');
  await page.getByRole('button', { name: 'Track order', exact: true }).click();
  await expectPublicOrder(page);
});

test('handles a public order returned by the courier fallback', async ({ page }) => {
  await page.route('**/api/orders/track-by-id/AWB10339', (route) => route.fulfill({ status: 404, json: { message: 'Order not found' } }));
  await page.route('**/api/orders/delivery-service/track/AWB10339', (route) => route.fulfill({
    json: { order: publicOrder, tracking: { trackingId: 'AWB10339', currentStatus: 'In transit', events: [] } },
  }));
  await page.goto('/track-orders');
  await search(page, 'AWB10339');
  await expectPublicOrder(page);
});

test('opens an older cached order with a missing total', async ({ page }) => {
  await page.addInitScript((order) => {
    localStorage.setItem('brajmart-orders', JSON.stringify({ state: { orders: [order] }, version: 0 }));
  }, {
    ...publicOrder, id: '10339', userId: '1', shippingAddress: {}, billingAddress: {},
    items: [{ product: { name: 'Tulsi Kanthi Mala', image: '/placeholder.svg' }, quantity: 2 }],
  });
  await page.goto('/track-orders');
  await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
  await expect(page.getByText('Not available', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /#AWB10339/ }).click();
  await expectPublicOrder(page);
});

test('keeps the correct payment breakdown for a complete order', async ({ page }) => {
  await page.addInitScript((order) => {
    localStorage.setItem('brajmart-orders', JSON.stringify({ state: { orders: [order] }, version: 0 }));
  }, {
    ...publicOrder, id: '10339', userId: '1', shippingAddress: {}, billingAddress: {},
    total: 350, itemsSubtotal: 300, shippingAmount: 50, packagingAmount: 0,
    items: [{ product: { name: 'Tulsi Kanthi Mala', image: '/placeholder.svg' }, price: 150, quantity: 2 }],
  });
  await page.goto('/track-orders');
  await page.getByRole('button', { name: /#AWB10339/ }).click();
  const breakdown = page.getByLabel('Payment breakdown');
  await expect(breakdown.getByText('₹300', { exact: true })).toBeVisible();
  await expect(breakdown.getByText('₹50', { exact: true })).toBeVisible();
  await expect(breakdown.getByText('₹350', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
});
