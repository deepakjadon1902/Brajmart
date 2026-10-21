import { expect, test } from '../playwright-fixture';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    sessionStorage.setItem('brajmart-last-success-order', JSON.stringify({ orderId: '999', total: 99999, paymentMethod: 'Razorpay', status: 'paid' }));
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.fulfill({ status: 200, body: '', contentType: 'application/javascript' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (/\/orders\/track\//.test(url.pathname)) return route.fulfill({ status: 404, json: { message: 'Order not found' } });
    return route.fulfill({ json: /products|categories|hero-slides|blogs|bundles/.test(url.pathname) ? [] : {} });
  });
});
test('a forged thank-you URL and session data cannot display a verified confirmation', async ({ page }) => {
  await page.goto('/thank-you?orderId=999&paid=true');
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  await expect(page.getByText('Verified BrajMart order confirmation', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Order confirmed', { exact: true })).toHaveCount(0);
});
test('a stale session order without a valid URL is rechecked with the server', async ({ page }) => {
  await page.goto('/thank-you');
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  await expect(page.getByText('Verified BrajMart order confirmation', { exact: true })).toHaveCount(0);
});
test('a real COD order uses server details and never trusts the session total', async ({ page }) => {
  await page.route('**/api/orders/track/123', (route) => route.fulfill({ json: { orderId: 123, status: 'confirmed', paymentMethod: 'COD', total: 249, items: [{ name: 'Server offering', quantity: 1 }] } }));
  await page.goto('/thank-you?orderId=123');
  await expect(page.getByText('Verified BrajMart order confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText('Server offering', { exact: true })).toBeVisible();
  await expect(page.getByText('₹99,999', { exact: false })).toHaveCount(0);
});
test('a cancelled order cannot display the success card', async ({ page }) => {
  await page.route('**/api/orders/track/123', (route) => route.fulfill({ json: { orderId: 123, status: 'cancelled', paymentMethod: 'Razorpay' } }));
  await page.goto('/thank-you?orderId=123');
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  await expect(page.getByText('Verified BrajMart order confirmation', { exact: true })).toHaveCount(0);
});
test('an unverified payment status stays pending even on a success-looking URL', async ({ page }) => {
  await page.route('**/api/payments/status/order_Fake', (route) => route.fulfill({ json: { token: 'order_Fake', status: 'pending', method: 'Razorpay', verificationStatus: 'unverified' } }));
  await page.goto('/payment-status/order_Fake?paid=true&success=true');
  await expect(page.getByRole('heading', { name: 'Payment Pending', exact: true })).toBeVisible();
  await expect(page.getByText('Payment verified and order confirmed', { exact: true })).toHaveCount(0);
});
test('a temporary status API outage remains unconfirmed and polling can recover', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/payments/status/order_Real', (route) => {
    if (++attempts === 1) return route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } });
    return route.fulfill({ json: { token: 'order_Real', status: 'paid', orderId: 42, method: 'Razorpay', amount: 249, paymentId: 'pay_Real', items: [{ name: 'Server offering', quantity: 1 }] } });
  });
  await page.goto('/payment-status/order_Real');
  await expect(page.getByRole('heading', { name: 'Payment Pending', exact: true })).toBeVisible();
  await expect(page.getByText('Payment verified and order confirmed', { exact: true })).toBeVisible({ timeout: 10_000 });
});
