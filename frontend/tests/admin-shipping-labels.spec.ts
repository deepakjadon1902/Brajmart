import { expect, test } from '@playwright/test';

const verifiedOrder = {
  _id: '10339',
  orderId: 10339,
  customerName: 'Bikram Paul',
  customerEmail: 'bikram@example.com',
  items: [{ productId: '1', name: 'Tulsi Mala', image: '/logo.png', quantity: 1, price: 302 }],
  total: 302,
  status: 'confirmed',
  shippingAddress: {
    fullName: 'Bikram Paul',
    mobile: '9876543210',
    street: 'Temple Road',
    city: 'Mathura',
    state: 'Uttar Pradesh',
    pincode: '281001',
  },
  billingAddress: {},
  paymentMethod: 'Razorpay',
  trackingId: 'AWB10339',
  shippingService: 'Delhivery',
  createdAt: '2026-10-14T08:00:00.000Z',
  updatedAt: '2026-10-14T08:00:00.000Z',
  statusHistory: [{ status: 'confirmed', date: '2026-10-14T08:00:00.000Z', note: 'Payment verified' }],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({
      state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' },
      version: 0,
    }));
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/orders' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([verifiedOrder]) });
    }
    if (url.pathname === '/api/shipping-labels/orders/10339/label' && request.method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          created: true,
          printUrl: 'https://shipping-labels-api.example.com/api/v1/auth/print-handoffs/redeem?token=one-time-token',
          label: { id: 'label-10339', status: 'Pending', tracking_id: 'AWB10339' },
        }),
      });
    }
    if (url.pathname === '/api/settings') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (url.pathname === '/api/products') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.context().route('https://shipping-labels-api.example.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<script>location.replace("https://labels.brajmart.com/print?ids=label-10339")</script>',
  }));
  await page.context().route('https://labels.brajmart.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<title>Shipping Labels Print</title><main>Label label-10339 ready to print</main>',
  }));
});

test('admin creates the mapped label and opens the labels print page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/orders');

  await expect(page.getByRole('heading', { name: 'Orders Management' })).toBeVisible();
  await expect(page.getByLabel('Cookie and performance notice')).toHaveCount(0);
  await expect(page.getByText('AWB10339')).toHaveCount(0);
  const printer = page.getByRole('button', { name: 'Create or print shipping label for order 10339' });
  await expect(printer).toBeVisible();

  const requestPromise = page.waitForRequest((request) => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/shipping-labels/orders/10339/label'
  ));
  const popupPromise = page.waitForEvent('popup');
  await printer.click();
  const [request, popup] = await Promise.all([requestPromise, popupPromise]);
  expect(request.postData()).toBeNull();
  await expect(popup).toHaveURL('https://labels.brajmart.com/print?ids=label-10339');
  await expect(page.getByText('Shipping label created and ready to print')).toBeVisible();

  await page.getByRole('button', { name: 'View order 10339' }).click();
  await expect(page.getByRole('button', { name: 'Print Shipping Label', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Label Status', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fetch Delhivery', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-orders-shipping-label-desktop.png', fullPage: true });
});

test('shipping label controls remain usable on a narrow admin viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/orders');
  await expect(page.getByLabel('Cookie and performance notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create or print shipping label for order 10339' })).toBeVisible();
  await page.getByRole('button', { name: 'View order 10339' }).click();
  const mobilePrintButton = page.getByRole('button', { name: 'Print Shipping Label', exact: true });
  await expect(mobilePrintButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Label Status', exact: true })).toBeVisible();
  await mobilePrintButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-orders-shipping-label-mobile.png', fullPage: true });
});

test('Shree Maruti orders show courier tracking and open the recovered label from the dialog', async ({ page }) => {
  await page.route(/\/api\/orders(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ ...verifiedOrder, shippingService: 'Shree Maruti' }]),
  }));
  await page.goto('/admin/orders');
  await page.getByRole('button', { name: 'View order 10339' }).click();
  await expect(page.getByRole('heading', { name: 'Courier AWB / Tracking ID' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fetch Delhivery', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check Delivery', exact: true })).toHaveCount(0);
  await expect(page.getByText('Save the shipping service and AWB/tracking ID, then use Sync Label Status to fetch courier updates. The shipping label is linked automatically.')).toBeVisible();

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print Shipping Label', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://labels.brajmart.com/print?ids=label-10339');
  await expect(page.getByText('Shipping label created and ready to print')).toBeVisible();
});

test('admin syncs a DTDC order directly without printing first or opening another tab', async ({ page }) => {
  let synced = false;
  const labelRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/10339/label')) labelRequests.push(request.url());
  });
  await page.route(/\/api\/(?:orders(?:\?|$)|shipping-labels\/orders\/10339\/sync$)/, (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/sync')) {
      synced = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: '10339', orderStatus: 'out_for_delivery', updated: true, label: { id: 'label-10339' } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ ...verifiedOrder, shippingService: 'DTDC', status: synced ? 'out_for_delivery' : 'shipped' }]),
    });
  });
  await page.goto('/admin/orders');
  await page.getByRole('button', { name: 'View order 10339' }).click();
  const pagesBeforeSync = page.context().pages().length;
  await page.getByRole('button', { name: 'Sync Label Status', exact: true }).click();
  await expect(page.getByText('Order updated to out for delivery')).toBeVisible();
  await expect(page.getByRole('button', { name: 'out for delivery', exact: true })).toHaveClass(/is-active/);
  expect(labelRequests).toHaveLength(0);
  expect(page.context().pages()).toHaveLength(pagesBeforeSync);
});

test('sync asks for a saved AWB before making an API request', async ({ page }) => {
  const syncRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/10339/sync')) syncRequests.push(request.url());
  });
  await page.route(/\/api\/orders(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ ...verifiedOrder, trackingId: '' }]),
  }));
  await page.goto('/admin/orders');
  await page.getByRole('button', { name: 'View order 10339' }).click();
  await page.getByRole('button', { name: 'Sync Label Status', exact: true }).click();
  await expect(page.getByText('Add and save the courier AWB/tracking ID before syncing courier status')).toBeVisible();
  expect(syncRequests).toHaveLength(0);
});

