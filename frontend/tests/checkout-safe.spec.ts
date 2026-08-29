import { expect, test } from '../playwright-fixture';

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
  await page.route('**/api/orders/dtdc/pincode', async (route) => route.fulfill({
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
  await page.getByRole('button', { name: /buy phase qa tulsi mala now/i }).click();
  await expect(page).toHaveURL(/\/checkout$/);
};

const fillShippingAddress = async (page: import('@playwright/test').Page) => {
  await page.getByLabel(/full name/i).fill('Phase Tester');
  await page.getByLabel(/address line 1/i).fill('Keshav Kunj, Raman Reti, Vrindavan');
  await page.getByLabel(/^city/i).fill('Vrindavan');
  await page.getByLabel(/^state/i).selectOption('Uttar Pradesh');
  await page.getByLabel(/pincode/i).fill('281121');
  await page.getByLabel(/mobile number/i).fill('9634359003');
  await page.getByLabel(/email address/i).fill('phase43@example.invalid');
};

test('checkout reaches verified payment step without starting live payment', async ({ page }) => {
  await mockCheckoutApis(page);
  await seedCart(page);

  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();

  await expect(page.getByRole('heading', { name: /payment method/i })).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with Razorpay - ₹248' })).toBeVisible();
});

test('add to cart path reaches checkout without starting live payment', async ({ page }) => {
  await mockCheckoutApis(page);

  await page.goto('/products');
  await page.getByRole('button', { name: /add phase qa tulsi mala to cart/i }).click();
  await expect(page.getByText(/added to cart/i).first()).toBeVisible();
  await page.getByRole('link', { name: /^checkout$/i }).click();

  await fillShippingAddress(page);
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await expect(page.getByRole('heading', { name: /payment method/i })).toBeVisible();
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
  await page.getByRole('button', { name: /continue to payment/i }).click();

  await expect(page.getByText('Phase QA Tulsi Mala price changed to ₹219.').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply cart updates', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /payment method/i })).not.toBeVisible();
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

    await expect(page.getByRole('heading', { name: /payment method/i })).toBeVisible();
    await page.keyboard.press('Tab');
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);
  });
});
