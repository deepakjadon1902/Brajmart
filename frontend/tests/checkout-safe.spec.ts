import { expect, test } from '../playwright-fixture';

const cashfreeOrder = {
  mode: 'sandbox',
  paymentSessionId: 'session_BrowserFixture',
  statusToken: 'cf_browser_fixture',
  orderId: 42,
};

const mockCashfreeSdk = (page: import('@playwright/test').Page, redirect = false) => page.addInitScript(({ redirect, statusToken }) => {
  const scope = window as unknown as {
    Cashfree: (options: { mode: string }) => {
      checkout: (checkoutOptions: { paymentSessionId: string; redirectTarget: string }) => Promise<void>;
    };
  };
  scope.Cashfree = ({ mode }) => ({
    async checkout(options) {
      sessionStorage.setItem('cashfree-fixture-call', JSON.stringify({ mode, ...options }));
      if (redirect) location.assign('/payment-status/' + statusToken);
    },
  });
}, { redirect, statusToken: cashfreeOrder.statusToken });

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

const mockCheckoutApis = async (page: import('@playwright/test').Page, validationOverride = {}, settingsOverride = {}) => {
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
      shippingFee: 69,
      packagingRate: 0,
      minOrderAmount: 0,
      maxOrderQuantity: 10,
      codEnabled: true,
      codFee: 40,
      upiEnabled: true,
      cardEnabled: true,
      cashfreeEnabled: true,
      ...settingsOverride,
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
      shipping: 69,
      packaging: 0,
      codFee: 40,
      grandTotal: 268,
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

test('admins can save a shipping fee and the storefront displays the saved rate', async ({ page }) => {
  const settings = { storeName: 'BrajMart', currency: 'INR', shippingFee: 69, freeShippingThreshold: 299 };
  await page.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({
      state: { isAdminAuthenticated: true, adminEmail: 'admin@example.invalid', token: 'shipping-test-token' },
      version: 0,
    }));
  });
  await page.route('**/api/settings**', async (route) => {
    if (route.request().method() === 'PUT') Object.assign(settings, route.request().postDataJSON());
    await route.fulfill({ json: settings });
  });

  const openShippingSettings = async () => {
    await page.goto('/admin/settings');
    await page.getByRole('button', { name: 'Shipping & Orders' }).click();
  };
  await openShippingSettings();
  const shippingFee = page.getByLabel('Shipping Fee (INR)');
  await expect(shippingFee).toHaveValue('69');
  await shippingFee.fill('82.5');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Settings updated', { exact: true })).toBeVisible();
  expect(settings.shippingFee).toBe(82.5);

  await page.goto('/shipping-delivery');
  await expect(page.getByText(/₹82\.5 flat rate below ₹299/)).toBeVisible();

  await openShippingSettings();
  await expect(shippingFee).toHaveValue('82.5');
  await shippingFee.fill('0');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Settings updated', { exact: true })).toBeVisible();
  expect(settings.shippingFee).toBe(0);

  await page.goto('/shipping-delivery');
  await expect(page.getByText('Standard shipping is free on all orders.')).toBeVisible();
});

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
  await expect(page.getByRole('button', { name: 'Pay Now - ₹268', exact: true })).toBeVisible();
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

test('a checkout draft saved with PayU opens with Cashfree selected', async ({ page }) => {
  await mockCheckoutApis(page);
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = 'brajmart-checkout-draft:guest';
    const draft = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...draft, step: 1, paymentMethod: 'payu' }));
  });
  await page.reload();
  await expect(page.getByRole('radio', { name: /^Cashfree/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /^PayU/ })).toHaveCount(0);
});

test('Cashfree is the only online gateway and waits for confirmed payment status', async ({ page }) => {
  await mockCashfreeSdk(page, true);
  await mockCheckoutApis(page);
  let paid = false;
  await page.route('**/api/cashfree/create-order', route => {
    expect(route.request().postDataJSON()).toMatchObject({ amount: 268, order: { paymentMethod: 'Cashfree' } });
    return route.fulfill({ json: cashfreeOrder });
  });
  await page.route('**/api/payments/status/cf_browser_fixture', route => route.fulfill({ json: {
    status: paid ? 'paid' : 'pending', method: 'Cashfree', amount: 268, orderId: 42, paymentId: '998877',
    items: [{ name: 'Phase QA Tulsi Mala', quantity: 1 }],
  } }));
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('radio', { name: /^Cashfree/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /^(PayU|Razorpay)/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Pay Now/ }).click();
  await expect(page).toHaveURL('/payment-status/cf_browser_fixture');
  await expect(page.getByRole('heading', { name: 'Payment Pending' })).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem('cashfree-fixture-call'))) || '{}')).toEqual({
    mode: 'sandbox', paymentSessionId: cashfreeOrder.paymentSessionId, redirectTarget: '_self',
  });
  paid = true;
  await expect(page.getByText('Payment verified and order confirmed', { exact: true })).toBeVisible();
});

test('checkout disables online payment when Cashfree is unavailable', async ({ page }) => {
  await mockCheckoutApis(page, {}, { cashfreeEnabled: false });
  await seedCart(page);
  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('radio', { name: /^Cashfree/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('radio', { name: /^PayU/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Online payment unavailable' })).toBeDisabled();
});

test('a failed legacy PayU payment provides order status and a link to checkout', async ({ page }) => {
  await page.route('**/api/payments/status/payu_browser_fixture', route => route.fulfill({ json: {
    status: 'failed', method: 'PayU', amount: 268, orderId: 42, items: [],
  } }));
  await page.goto('/payment-status/payu_browser_fixture');
  await expect(page.getByRole('heading', { name: 'Payment Failed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Checkout' })).toHaveAttribute('href', '/checkout');
  await expect(page.getByRole('button', { name: /pay again/i })).toHaveCount(0);
});

test('Cashfree resumes an eligible checkout using the original order token', async ({ page }) => {
  await mockCashfreeSdk(page);
  await page.route('**/api/payments/status/cf_browser_fixture', route => route.fulfill({ json: {
    status: 'pending', method: 'Cashfree', canResume: true, amount: 268, orderId: 42,
  } }));
  await page.route('**/api/cashfree/resume', route => {
    expect(route.request().postDataJSON()).toEqual({ token: cashfreeOrder.statusToken });
    return route.fulfill({ json: cashfreeOrder });
  });
  await page.goto('/payment-status/cf_browser_fixture');
  await page.getByRole('button', { name: 'Continue with Cashfree' }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cashfree-fixture-call'))).toContain(cashfreeOrder.paymentSessionId);
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
