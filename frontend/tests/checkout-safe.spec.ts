import { expect, test } from '../playwright-fixture';

type RazorpayFixtureOptions = {
  key: string; amount: number; currency: string; order_id: string;
  handler: (response: Record<string, string>) => Promise<void>;
};
type RazorpayFixtureWindow = {
  Razorpay: unknown;
  __razorpayFixture: { opened: boolean; options: RazorpayFixtureOptions | null };
};

const installRazorpayFixture = (page: import('@playwright/test').Page) => page.addInitScript(() => {
  const scope = window as unknown as RazorpayFixtureWindow;
  scope.__razorpayFixture = { opened: false, options: null };
  scope.Razorpay = class {
    constructor(options: RazorpayFixtureOptions) { scope.__razorpayFixture.options = options; }
    open() { scope.__razorpayFixture.opened = true; }
    close() { scope.__razorpayFixture.opened = false; }
    on() { /* All gateway events stay inside this isolated browser fixture. */ }
  };
});

const fixtureGatewayOrder = {
  keyId: 'rzp_live_IsolatedBrowser', orderId: 'order_BrowserFixture', statusToken: 'order_BrowserFixture',
  amount: 24800, currency: 'INR', name: 'BrajMart', description: 'Isolated browser fixture', prefill: {},
};

const expectRazorpayOpened = async (page: import('@playwright/test').Page) => {
  await expect.poll(() => page.evaluate(() => (window as unknown as RazorpayFixtureWindow).__razorpayFixture.opened)).toBe(true);
  return page.evaluate(() => {
    const options = (window as unknown as RazorpayFixtureWindow).__razorpayFixture.options!;
    return { key: options.key, amount: options.amount, currency: options.currency, orderId: options.order_id };
  });
};

const cartState = {
  state: {
    items: [
      {
        product: {
          id: 'phase43-product-1',
          name: 'Phase QA Tulsi Mala',
          slug: 'phase-qa-tulsi-mala',
          price: 199,
          originalPrice: 249,
          image: '/placeholder.svg',
          category: 'Accessories',
          rating: 4.8,
          reviewCount: 12,
          inStock: true,
          stockQuantity: 10,
          reservedQuantity: 0,
        },
        quantity: 1,
      },
    ],
    drawerOpen: false,
    lastAddedProductId: '',
  },
  version: 0,
};

const mockCheckoutApis = async (page: import('@playwright/test').Page, validationOverride = {}) => {
  const product = cartState.state.items[0].product;
  await page.route('**/api/products**', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([product]),
  }));
  await page.route('**/api/categories**', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'phase43-category-1', name: 'Accessories', slug: 'accessories', productCount: 1 }]),
  }));
  await page.route('**/api/settings**', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      storeName: 'BrajMart',
      currency: 'INR',
      freeShippingThreshold: 299,
      shippingFee: 49,
      packagingRate: 0,
      minOrderAmount: 0,
      maxOrderQuantity: 10,
      codEnabled: true,
      codFee: 40,
      upiEnabled: true,
      cardEnabled: true,
    }),
  }));
  await page.route('**/api/orders/delivery-service/pincode', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      carrier: 'DTDC',
      desPincode: '281121',
      serviceable: true,
      codAvailable: false,
      message: 'Delivery available | COD not available',
    }),
  }));
  await page.route('**/api/cart/validate', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        productId: 'phase43-product-1',
        name: 'Phase QA Tulsi Mala',
        slug: 'phase-qa-tulsi-mala',
        image: '/placeholder.svg',
        category: 'Accessories',
        quantity: 1,
        price: 199,
        originalPrice: 249,
        inStock: true,
        availableQuantity: 10,
      }],
      subtotal: 199,
      discount: 0,
      shipping: 49,
      packaging: 0,
      codFee: 40,
      grandTotal: 248,
      currency: 'INR',
      changes: [],
      unavailableItems: [],
      pricingVersion: 'cart-v1',
      validatedAt: new Date().toISOString(),
      ...validationOverride,
    }),
  }));
};

const seedCart = async (page: import('@playwright/test').Page) => {
  await page.goto('/products');
  await page.getByRole('button', { name: /buy now: phase qa tulsi mala/i }).click();
  await expect(page).toHaveURL(/\/checkout$/);
};

test('cart and favorites share one reminder preference across storefront navigation', async ({ page }) => {
  await mockCheckoutApis(page);
  const captures: Record<string, any>[] = [];
  await page.route('**/api/email-followups/capture', route => {
    captures.push(route.request().postDataJSON());
    return route.fulfill({ json: { saved: true, reminderScheduled: true } });
  });
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add Phase QA Tulsi Mala to wishlist', exact: true }).click();
  await page.getByRole('button', { name: /buy now: phase qa tulsi mala/i }).click();
  await page.goto('/cart');
  const option = page.getByRole('checkbox', { name: /Email me a reminder about my cart and favorites/ });
  await expect(option).not.toBeChecked();
  await page.getByLabel('Reminder email').fill('saved@example.invalid');
  await option.check();
  await expect(page.getByText(/Reminder saved. We will check current prices/)).toBeVisible();
  expect(captures).toHaveLength(1);
  expect(captures[0]).toMatchObject({ reminderSource: 'saved_products', items: [{ productId: 'phase43-product-1', quantity: 1 }], favoriteItems: [{ productId: 'phase43-product-1', quantity: 1 }] });
  await page.getByRole('link', { name: 'Wishlist', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'My Wishlist (1)' })).toBeVisible();
  await expect(option).toBeChecked();
  expect(captures).toHaveLength(1);
  await option.uncheck();
  await expect.poll(() => captures.length).toBe(2);
  expect(captures[1]).toMatchObject({ revokeCartReminder: true, consent: { cartReminder: false } });
});

test('favorites-only reminder clears its queued snapshot when the last favorite is removed', async ({ page }) => {
  await mockCheckoutApis(page);
  const captures: Record<string, any>[] = [];
  await page.route('**/api/email-followups/capture', route => {
    captures.push(route.request().postDataJSON());
    return route.fulfill({ json: { saved: true, reminderScheduled: true } });
  });
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add Phase QA Tulsi Mala to wishlist', exact: true }).click();
  await page.goto('/wishlist');
  await page.getByLabel('Reminder email').fill('favorites@example.invalid');
  await page.getByRole('checkbox', { name: /Email me a reminder about my cart and favorites/ }).check();
  await expect(page.getByText(/Reminder saved. We will check current prices/)).toBeVisible();
  expect(captures[0].items).toEqual([]);
  expect(captures[0].favoriteItems).toHaveLength(1);
  await page.getByRole('button', { name: 'Remove Phase QA Tulsi Mala from wishlist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Wishlist is Empty' })).toBeVisible();
  await expect.poll(() => captures.length).toBe(2);
  expect(captures[1].favoriteItems).toEqual([]);
  expect(captures[1].items).toEqual([]);
});

test('saved-product reminder can retry a failed save on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCheckoutApis(page);
  let attempts = 0;
  await page.route('**/api/email-followups/capture', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } })
      : route.fulfill({ json: { saved: true, reminderScheduled: true } });
  });
  await seedCart(page);
  await page.goto('/cart');
  await page.getByLabel('Reminder email').fill('retry@example.invalid');
  await page.getByRole('checkbox', { name: /Email me a reminder about my cart and favorites/ }).check();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText(/Reminder saved. We will check current prices/)).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('saved-reminder-mobile.png'), fullPage: true });
});

const fillShippingAddress = async (page: import('@playwright/test').Page) => {
  await page.getByLabel(/full name/i).fill('Phase Tester');
  await page.getByLabel(/house \/ flat \/ area/i).fill('Keshav Kunj, Raman Reti, Vrindavan');
  await page.getByLabel(/^city/i).fill('Vrindavan');
  await page.getByLabel(/^state/i).selectOption('Uttar Pradesh');
  await page.getByLabel(/pincode/i).fill('281121');
  await page.getByLabel(/mobile number/i).fill('9634359003');
  await page.getByLabel(/email address/i).fill('phase43@example.invalid');
};

test('cart reminder saves before the customer submits an address and withdraws when unchecked', async ({ page }) => {
  await mockCheckoutApis(page);
  const captures: Record<string, any>[] = [];
  await page.route('**/api/email-followups/capture', (route) => {
    const body = route.request().postDataJSON();
    captures.push(body);
    return route.fulfill({ json: { saved: true, reminderScheduled: body.consent.cartReminder } });
  });
  await seedCart(page);
  await page.getByLabel(/email address/i).fill('cart-reminder@example.invalid');
  const checkbox = page.getByRole('checkbox', { name: /send me one email reminder/i });
  await checkbox.check();
  await expect(page.getByText('Contact preferences saved.', { exact: true })).toBeVisible();
  expect(captures).toHaveLength(1);
  expect(captures[0].email).toBe('cart-reminder@example.invalid');
  expect(captures[0].consent).toEqual({ cartReminder: true, offerEmail: false, whatsappFollowup: false });
  expect(captures[0].items).toHaveLength(1);
  await expect(page.getByText(/It will be sent after 3 hours/)).toBeVisible();
  await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
  await checkbox.uncheck();
  await expect.poll(() => captures.length).toBe(2);
  expect(captures[1].revokeCartReminder).toBe(true);
  expect(captures[1].consent.cartReminder).toBe(false);
  await page.screenshot({ path: '.test-results/email-followups/cart-reminder-checkout.png', fullPage: true });
});

test('cart reminder save failures can be retried and continuing to payment does not duplicate the saved job', async ({ page }) => {
  await mockCheckoutApis(page);
  let captures = 0;
  let fail = true;
  await page.route('**/api/email-followups/capture', (route) => {
    captures++;
    return fail
      ? route.fulfill({ status: 503, json: { message: 'Could not save email preferences right now.' } })
      : route.fulfill({ json: { saved: true, reminderScheduled: true } });
  });
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('checkbox', { name: /send me one email reminder/i }).check();
  await expect(page.getByText(/We could not save your contact preferences/)).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Contact preferences saved.', { exact: true })).toBeVisible();
  expect(captures).toBe(2);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
  expect(captures).toBe(2);
});

test('checkout reaches verified payment step without starting live payment', async ({ page }) => {
  await mockCheckoutApis(page);
  await seedCart(page);

  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();

  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay Now - ₹248', exact: true })).toBeVisible();
});

test('add to cart path reaches checkout without starting live payment', async ({ page }) => {
  await mockCheckoutApis(page);

  await page.goto('/products');
  await page.getByRole('button', { name: 'Add Phase QA Tulsi Mala to cart', exact: true }).click();
  await expect(page.getByText(/added to cart/i).first()).toBeVisible();
  await page.getByRole('link', { name: /^checkout$/i }).click();

  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
});

test('checkout blocks payment when backend validation reports cart changes', async ({ page }) => {
  await mockCheckoutApis(page, {
    changes: [{
      productId: 'phase43-product-1',
      type: 'price',
      message: 'Phase QA Tulsi Mala price changed to ₹219.',
      previousPrice: 199,
      currentPrice: 219,
    }],
  });
  await seedCart(page);

  await fillShippingAddress(page);
  const continueButton = page.getByRole('button', { name: /continue to payment/i });
  if (await continueButton.isVisible()) await continueButton.click();

  await expect(page.getByText('Phase QA Tulsi Mala price changed to ₹219.').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply cart updates', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).not.toBeVisible();
});

test('Pay Now opens Razorpay with server-owned values and verifies its callback before confirmation', async ({ page }) => {
  await installRazorpayFixture(page);
  await mockCheckoutApis(page);
  const creates: Record<string, unknown>[] = [];
  const verifications: Record<string, unknown>[] = [];
  await page.route('**/api/razorpay/create-order', route => {
    creates.push(route.request().postDataJSON());
    return route.fulfill({ json: fixtureGatewayOrder });
  });
  await page.route('**/api/razorpay/verify', route => {
    verifications.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, orderId: 42, status: 'paid' } });
  });
  await page.route('**/api/payments/status/order_BrowserFixture', route => route.fulfill({ json: {
    token: fixtureGatewayOrder.orderId, status: verifications.length ? 'paid' : 'pending',
    method: 'Razorpay', amount: 248, orderId: 42, paymentId: 'pay_BrowserFixture',
    items: [{ name: 'Phase QA Tulsi Mala', quantity: 1 }],
  } }));
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await page.getByRole('button', { name: /^Pay Now/ }).click();
  expect(await expectRazorpayOpened(page)).toEqual({
    key: fixtureGatewayOrder.keyId, amount: 24800, currency: 'INR', orderId: fixtureGatewayOrder.orderId,
  });
  expect(creates).toHaveLength(1);
  expect(creates[0].amount).toBe(248);
  expect(creates[0].idempotencyKey).toBeTruthy();
  expect(verifications).toHaveLength(0);
  await expect(page).toHaveURL(/\/checkout$/);
  await page.evaluate(async () => {
    await (window as unknown as RazorpayFixtureWindow).__razorpayFixture.options!.handler({
      razorpay_order_id: 'order_BrowserFixture', razorpay_payment_id: 'pay_BrowserFixture', razorpay_signature: 'a'.repeat(64),
    });
  });
  await expect(page.getByText('Payment verified and order confirmed', { exact: true })).toBeVisible();
  expect(verifications).toHaveLength(1);
  expect(verifications[0]).toMatchObject({
    razorpay_order_id: fixtureGatewayOrder.orderId, razorpay_payment_id: 'pay_BrowserFixture', razorpay_signature: 'a'.repeat(64),
  });
});

test('a configuration outage can recover on Pay Now without losing the cart or changing the idempotency key', async ({ page }) => {
  await installRazorpayFixture(page);
  await mockCheckoutApis(page);
  let unavailable = true;
  const idempotencyKeys: string[] = [];
  await page.route('**/api/razorpay/create-order', route => {
    idempotencyKeys.push(route.request().postDataJSON().idempotencyKey);
    return unavailable
      ? route.fulfill({ status: 503, json: { code: 'PAYMENT_UNAVAILABLE', message: 'Online payment is temporarily unavailable. Please try again shortly or contact support.' } })
      : route.fulfill({ json: fixtureGatewayOrder });
  });
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await page.getByRole('button', { name: /^Pay Now/ }).click();
  await expect(page.getByText('Online payment is temporarily unavailable. Please try again shortly or contact support.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pay Now/ })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as RazorpayFixtureWindow).__razorpayFixture.opened)).toBe(false);
  await expect(page.getByText('Phase QA Tulsi Mala', { exact: true }).first()).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: /^Pay Now/ }).click();
  await expectRazorpayOpened(page);
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test('payment retry opens the new server order and verifies its signed callback', async ({ page }) => {
  await installRazorpayFixture(page);
  await mockCheckoutApis(page);
  let retries = 0;
  let verified = false;
  await page.route('**/api/payments/status/order_PreviousFixture', route => route.fulfill({ json: {
    status: 'failed', orderId: 42, amount: 248, method: 'Razorpay',
  } }));
  await page.route('**/api/razorpay/retry-order', route => {
    expect(route.request().postDataJSON().token).toBe('order_PreviousFixture');
    retries++;
    return route.fulfill({ json: fixtureGatewayOrder });
  });
  await page.route('**/api/razorpay/verify', route => {
    expect(route.request().postDataJSON()).toMatchObject({ razorpay_order_id: fixtureGatewayOrder.orderId, razorpay_payment_id: 'pay_RetryFixture' });
    verified = true;
    return route.fulfill({ json: { ok: true, orderId: 42, status: 'paid' } });
  });
  await page.route('**/api/payments/status/order_BrowserFixture', route => route.fulfill({ json: {
    status: verified ? 'paid' : 'pending', orderId: 42, amount: 248, method: 'Razorpay', items: [{ name: 'Phase QA Tulsi Mala', quantity: 1 }],
  } }));
  await page.goto('/payment-status/order_PreviousFixture');
  await page.getByRole('button', { name: 'Pay Again', exact: true }).click();
  expect((await expectRazorpayOpened(page)).orderId).toBe(fixtureGatewayOrder.orderId);
  expect(retries).toBe(1);
  expect(verified).toBe(false);
  await page.evaluate(async () => {
    await (window as unknown as RazorpayFixtureWindow).__razorpayFixture.options!.handler({
      razorpay_order_id: 'order_BrowserFixture', razorpay_payment_id: 'pay_RetryFixture', razorpay_signature: 'b'.repeat(64),
    });
  });
  await expect(page.getByText('Payment verified and order confirmed', { exact: true })).toBeVisible();
  expect(verified).toBe(true);
});

[
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
].forEach((viewport) => {
  test(`mobile checkout has no horizontal overflow before payment at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockCheckoutApis(page);
    await seedCart(page);

    await fillShippingAddress(page);
    await page.getByRole('button', { name: /continue to payment/i }).click();

    await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);
  });
});
