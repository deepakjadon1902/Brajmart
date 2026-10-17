import { expect, test, type Page } from '@playwright/test';

const categories = [{ id: '1', name: 'Prasadam', icon: '', color: '', productCount: 8, subcategories: [] }];
const makeProducts = () => Array.from({ length: 8 }, (_, index) => ({
  id: String(index + 1), name: `Offering ${index + 1}`, slug: `offering-${index + 1}`,
  category: 'Prasadam', categoryId: 1, image: '/logo.png', images: ['/logo.png'], price: 100,
  description: 'Authentic devotional offering from Vrindavan.', rating: 5, reviewCount: 100 - index,
  soldCount: 0, inStock: true, showOnHome: false, homePosition: null as number | null,
  tags: [], attributes: [], variantPricing: [], colorVariants: [], sizes: [], sizePricing: [], piecePricing: [],
}));
let products: ReturnType<typeof makeProducts>;
let failSave = false;
const position = (page: Page, name: string) => page.getByRole('combobox', { name: `Home position for ${name}`, exact: true });
const homeSection = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Prasadam', exact: true }) });

test.beforeEach(async ({ context }) => {
  products = makeProducts(); failSave = false;
  await context.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({ state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' }, version: 0 }));
    // Keep the network catalog mock authoritative; manually deliver stream events
    // in the live-refresh test instead of opening a server connection.
    const state = window as unknown as { catalogStreams: EventTarget[]; EventSource: unknown };
    state.catalogStreams = [];
    state.EventSource = class extends EventTarget {
      constructor() { super(); state.catalogStreams.push(this); setTimeout(() => this.dispatchEvent(new Event('catalog-updated')), 0); }
      close() {}
    };
  });
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/products' && request.method() === 'GET') return route.fulfill({ json: products });
    const id = url.pathname.match(/^\/api\/products\/(\d+)$/)?.[1];
    if (id && request.method() === 'PUT') {
      if (failSave) return route.fulfill({ status: 500, json: { message: 'Could not save home position' } });
      const body = request.postDataJSON();
      const chosen = products.find((product) => product.id === id)!;
      for (const product of products) if (product.id !== id && product.categoryId === chosen.categoryId && body.homePosition && product.homePosition === body.homePosition) {
        product.homePosition = null; product.showOnHome = false;
      }
      Object.assign(chosen, body, { showOnHome: body.homePosition !== null });
      return route.fulfill({ json: chosen });
    }
    if (url.pathname === '/api/categories') return route.fulfill({ json: categories });
    if (['/api/hero-slides', '/api/blogs', '/api/reviews', '/api/bundles'].includes(url.pathname)) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
});

test('product list reserves a numbered position, keeps six products, and persists after reload', async ({ page }) => {
  await page.goto('/admin/products');
  await position(page, 'Offering 8').selectOption('4');
  await expect(page.getByText('Home position 4 saved', { exact: true })).toBeVisible();
  await expect(position(page, 'Offering 8')).toHaveValue('4');
  await page.goto('/');
  await expect(homeSection(page).locator('h3')).toHaveText(['Offering 1', 'Offering 2', 'Offering 3', 'Offering 8', 'Offering 5', 'Offering 6']);
  await page.reload();
  await expect(homeSection(page).locator('h3')).toHaveText(['Offering 1', 'Offering 2', 'Offering 3', 'Offering 8', 'Offering 5', 'Offering 6']);
});

test('an occupied position is replaced and Automatic restores the original six picks', async ({ page }) => {
  products[6].showOnHome = true; products[6].homePosition = 2;
  await page.goto('/admin/products');
  await position(page, 'Offering 8').selectOption('2');
  await expect(position(page, 'Offering 7')).toHaveValue('');
  await expect(page.getByText('Home position 2 saved', { exact: true })).toBeVisible();
  await position(page, 'Offering 8').selectOption('');
  await expect(position(page, 'Offering 8')).toBeEnabled();
  await page.goto('/');
  await expect(homeSection(page).locator('h3')).toHaveText(['Offering 1', 'Offering 2', 'Offering 3', 'Offering 4', 'Offering 5', 'Offering 6']);
});

test('product editor previews numbered positions and saves the choice', async ({ page }) => {
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Edit Offering 8', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Edit Product', exact: true });
  await expect(modal).toBeVisible();
  await modal.getByRole('combobox', { name: 'Home position for Offering 8', exact: true }).selectOption('5');
  const preview = page.getByLabel('Category home page preview');
  await expect(preview.getByText('Offering 8', { exact: true })).toBeVisible();
  await expect(preview.getByText('Your selection', { exact: true })).toHaveCount(1);
  await preview.screenshot({ path: 'test-results/home-placement-editor-preview.png' });
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(position(page, 'Offering 8')).toHaveValue('5');
  await page.goto('/');
  await expect(homeSection(page).locator('h3').nth(4)).toHaveText('Offering 8');
});

test('a failed save rolls back the optimistic controls', async ({ page }) => {
  products[6].showOnHome = true; products[6].homePosition = 3;
  failSave = true;
  await page.goto('/admin/products');
  await position(page, 'Offering 8').selectOption('3');
  await expect(page.getByText('Could not save home position', { exact: true })).toBeVisible();
  await expect(position(page, 'Offering 7')).toHaveValue('3');
  await expect(position(page, 'Offering 8')).toHaveValue('');
});

test('an open homepage refreshes on catalog events without navigation', async ({ page }) => {
  await page.goto('/');
  await expect(homeSection(page).locator('h3')).toHaveCount(6);
  products[7].homePosition = 1; products[7].showOnHome = true;
  await page.evaluate(() => (window as unknown as { catalogStreams: EventTarget[] }).catalogStreams.forEach((stream) => stream.dispatchEvent(new Event('catalog-updated'))));
  await expect(homeSection(page).locator('h3').first()).toHaveText('Offering 8');
  await expect(homeSection(page).locator('h3')).toHaveCount(6);
  await homeSection(page).screenshot({ path: 'test-results/home-placement-live-category.png' });
});

test('editing a legacy selection preserves its existing home position', async ({ page }) => {
  products[6].showOnHome = true; products[7].showOnHome = true;
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Edit Offering 8', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Edit Product', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('combobox', { name: 'Home position for Offering 8', exact: true })).toHaveValue('2');
  await modal.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.goto('/');
  await expect(homeSection(page).locator('h3')).toHaveText(['Offering 7', 'Offering 8', 'Offering 3', 'Offering 4', 'Offering 5', 'Offering 6']);
});
