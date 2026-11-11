import { expect, test } from '../playwright-fixture';

test('admin saves HSN, unit and a decimal GST rate, then preserves it after reload', async ({ page }) => {
  let product = {
    id: '21', name: 'Devotional Toys', slug: 'devotional-toys', category: 'Idols', categoryId: 1,
    image: '/logo.png', price: 219, description: 'A devotional toy set.', rating: 0, reviewCount: 0,
    inStock: true, hsnCode: null as string | null, unit: null as string | null, gstRate: null as number | null,
    attributes: [], variantPricing: [], colorVariants: [], sizes: [], sizePricing: [], piecePricing: [],
  };
  await page.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({ state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' }, version: 0 }));
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/products/21' && route.request().method() === 'PUT') {
      product = { ...product, ...route.request().postDataJSON() };
      return route.fulfill({ json: product });
    }
    if (url.pathname === '/api/products/devotional-toys') return route.fulfill({ json: product });
    if (url.pathname === '/api/products') return route.fulfill({ json: [product] });
    if (url.pathname === '/api/categories') return route.fulfill({ json: [{ id: '1', name: 'Idols', subcategories: [] }] });
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Edit Devotional Toys', exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'Edit Product', exact: true });
  await modal.getByRole('textbox', { name: 'HSN Code', exact: true }).fill('9503');
  await modal.getByRole('textbox', { name: 'Unit (PCS, SET, KG...)', exact: true }).fill('SET');
  const rate = modal.getByRole('spinbutton', { name: 'GST Rate (%)', exact: true });
  await rate.fill('5');
  await expect(modal.getByText('Per unit: INR 208.57 taxable + INR 10.43 GST = INR 219.00', { exact: true })).toBeVisible();
  await rate.fill('');
  await rate.pressSequentially('5.25');
  await expect(rate).toHaveValue('5.25');
  await modal.getByText('Invoice & GST', { exact: true }).scrollIntoViewIfNeeded();
  await modal.screenshot({ path: test.info().outputPath('admin-product-gst.png') });
  await modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(product.gstRate).toBe(5.25);
  expect(product.hsnCode).toBe('9503');
  expect(product.unit).toBe('SET');
  await page.reload();
  await page.getByRole('button', { name: 'Edit Devotional Toys', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Edit Product', exact: true });
  await expect(modal.getByRole('spinbutton', { name: 'GST Rate (%)', exact: true })).toHaveValue('5.25');
  await expect(modal.getByRole('textbox', { name: 'HSN Code', exact: true })).toHaveValue('9503');
  await modal.getByRole('spinbutton', { name: 'GST Rate (%)', exact: true }).fill('0');
  await expect(modal.getByText('Per unit: INR 219.00 taxable + INR 0.00 GST = INR 219.00', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect(product.gstRate).toBe(0);
});
