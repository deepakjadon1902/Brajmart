import { expect, test, type Page } from '../playwright-fixture';

let settings: Record<string, unknown>;
let failSave: boolean;
const initialSettings = {
  storeName: 'BrajMart', tagline: 'From Braj, with devotion', currency: 'INR',
  storeLogo: '/logo.png', storeEmail: '', storePhone: '', storeAddress: 'Vrindavan, India',
  freeShippingThreshold: 299, shippingFee: 49, packagingRate: 0, minOrderAmount: 0, maxOrderQuantity: 0,
  deliveryEtaMinDays: 3, deliveryEtaMaxDays: 7, codEnabled: true, codFee: 40,
  maintenanceMode: false, metaTitle: '', metaDescription: '', heroBadges: [],
  socialLinks: { instagram: '', facebook: '', youtube: '', whatsapp: '' },
  announcementBar: { enabled: true, messages: ['Free Shipping on Orders Above ₹299'] },
  notifications: { orders: true, users: true, payments: true, stock: false }, festivalTheme: 'none',
};

test.beforeEach(async ({ context }) => {
  settings = structuredClone(initialSettings); failSave = false;
  await context.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({ state: { isAdminAuthenticated: true, adminEmail: 'admin@example.invalid', token: 'festival-test-token' }, version: 0 }));
    localStorage.setItem('brajmart-cookie-consent', JSON.stringify({ version: '2026-10', dismissedAt: '2026-11-02T00:00:00.000Z' }));
  });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/settings') {
      if (request.method() === 'PUT') {
        if (failSave) return route.fulfill({ status: 503, json: { message: 'Could not save festival decoration. Please retry.' } });
        Object.assign(settings, request.postDataJSON());
      }
      return route.fulfill({ json: settings });
    }
    if (['/api/products', '/api/categories', '/api/blogs', '/api/hero-slides', '/api/coupons', '/api/bundles', '/api/orders', '/api/payments', '/api/users'].includes(path)) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
});

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
const wishes = (page: Page, name: string) => page.getByRole('dialog', { name: name === 'Diwali' ? 'Shubh Deepavali' : 'Happy Holi' });

test('the selected festival decorates only the authenticated admin dashboard and leaves its navigation usable', async ({ page }) => {
  test.setTimeout(120_000);
  for (const theme of ['diwali', 'holi']) {
    settings.festivalTheme = theme;
    for (const size of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await page.goto('/admin/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      const decor = page.getByTestId('festival-decorations');
      await expect(decor).toHaveCount(1);
      await expect(decor).toHaveClass(new RegExp(`festival-${theme}.*festival-admin-dashboard`));
      await expect(page.getByTestId('festival-toran')).toHaveCount(1);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(decor.getByTestId('diwali-fireworks')).toHaveCount(theme === 'diwali' ? 1 : 0);
      expect(await decor.evaluate(node => getComputedStyle(node).position)).toBe('absolute');
      expect(await decor.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
      const main = (await page.locator('.admin-content').boundingBox())!;
      const overlay = (await decor.boundingBox())!;
      expect(overlay.x).toBeGreaterThanOrEqual(main.x);
      expect(overlay.x + overlay.width).toBeLessThanOrEqual(main.x + main.width);
      await noOverflow(page);
      await page.screenshot({ path: `.test-results/festival-dashboard-${theme}-${size.width}.png`, animations: 'disabled' });
      await page.locator('.admin-content').evaluate(node => node.scrollTo(0, node.scrollHeight));
      if (theme === 'diwali') {
        const summaryBottom = await page.locator('.admin-dashboard-summary-card').evaluateAll(nodes => Math.max(...nodes.map(node => node.getBoundingClientRect().bottom)));
        for (const lamps of await decor.locator('.diwali-lamps-layout').filter({ visible: true }).all()) {
          await expect(lamps).toBeInViewport();
          expect((await lamps.boundingBox())!.y).toBeGreaterThan(summaryBottom);
        }
      }
      await page.screenshot({ path: `.test-results/festival-dashboard-${theme}-floor-${size.width}.png`, animations: 'disabled' });
      await page.getByRole('link', { name: 'View All', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/orders$/);
      await expect(decor).toHaveCount(0);
      await expect(page.getByTestId('festival-toran')).toHaveCount(0);
      if (size.width < 1024) await page.locator('.admin-light header button:visible').first().click();
      await page.locator('.admin-light aside').getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/settings$/);
      await expect(decor).toHaveCount(0);
    }
  }
  await page.goto('/admin/dashboard');
  await expect(page.getByTestId('festival-decorations')).toBeVisible();
  await page.locator('.admin-light header button:visible').first().click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByTestId('festival-decorations')).toHaveCount(0);
});

test('admin selection applies page decorations and matching dismissible wishes without a homepage banner', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ['Diwali', 'Holi']) {
    await page.goto('/admin/settings');
    await page.getByRole('button', { name: `Apply ${theme} decorations` }).click();
    await expect(page.getByText(`${theme} active`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('festival-decorations')).toHaveCount(0);
    if (theme === 'Diwali') await page.screenshot({ path: '.test-results/festival-objects-admin-desktop.png', animations: 'disabled' });
    await page.reload();
    await expect(page.getByText(`${theme} active`, { exact: true })).toBeVisible();
    await page.goto('/');
    await expect(wishes(page, theme)).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `.test-results/festival-${theme.toLowerCase()}-wishes-desktop.png`, animations: 'disabled' });
    await page.getByRole('button', { name: /Continue exploring/ }).click();
    await expect(wishes(page, theme)).toHaveCount(0);
    await expect(page.getByTestId('festival-decorations')).toHaveClass(new RegExp(`festival-${theme.toLowerCase()}`));
    await expect(page.locator('.festival-banner')).toHaveCount(0);
    for (const motif of theme === 'Diwali' ? ['diya', 'candle', 'rocket', 'sparkler'] : ['balloons', 'pichkari', 'gulal', 'splash']) {
      await expect(page.getByTestId('festival-decorations').locator(`[data-motif="${motif}"]`).first()).toBeVisible();
    }
    expect(await page.getByTestId('festival-decorations').evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
    await page.screenshot({ path: `.test-results/festival-${theme.toLowerCase()}-objects-desktop.png`, animations: 'disabled' });
    await page.goto('/products');
    await expect(page.getByTestId('festival-decorations')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.goto('/admin/settings');
  await page.getByRole('button', { name: 'Turn decorations off' }).click();
  await expect(page.getByText('Decorations off', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('festival-decorations')).toHaveCount(0);
  await expect(page.getByTestId('festival-toran')).toHaveCount(0);
});

test('wishes return after refresh and stay dismissed during normal browsing', async ({ page }) => {
  settings.festivalTheme = 'diwali';
  await page.goto('/');
  await expect(wishes(page, 'Diwali')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Search Prasadam, Gita, Tulsi Mala...').fill('Tulsi');
  await page.locator('header form').first().getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=Tulsi$/);
  await expect(page.getByTestId('festival-decorations')).toBeVisible();
  await page.locator('header').getByRole('link', { name: 'BrajMart', exact: true }).click();
  // Wait past the greeting delay by observing the scheduled settings refresh.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(wishes(page, 'Diwali')).toBeVisible();
  await page.getByRole('button', { name: 'Close festival wishes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile wishes fit the screen and decorations leave menu, search and bottom navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['Diwali', 'Holi']) {
    settings.festivalTheme = theme.toLowerCase();
    await page.goto('/');
    await expect(wishes(page, theme)).toBeVisible();
    const box = await wishes(page, theme).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(12);
    expect(box!.y).toBeGreaterThanOrEqual(12);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844 - 12);
    expect(await wishes(page, theme).evaluate(node => getComputedStyle(node).animationName)).toBe('none');
    await page.screenshot({ path: `.test-results/festival-${theme.toLowerCase()}-wishes-mobile.png`, animations: 'disabled' });
    await page.getByRole('button', { name: /Continue exploring/ }).click();
    await noOverflow(page);
    await page.screenshot({ path: `.test-results/festival-${theme.toLowerCase()}-objects-mobile.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('link', { name: 'All Products', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByPlaceholder('Search products...').fill('Tulsi');
    await page.getByRole('button', { name: 'Search', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/search\?q=Tulsi$/);
    await expect(page.getByTestId('festival-decorations')).toBeVisible();
  }
});

test('direct product, blog and checkout visits show decorations without opening a greeting', async ({ page }) => {
  settings.festivalTheme = 'holi';
  for (const path of ['/products', '/blog', '/checkout']) {
    await page.goto(path);
    await expect(page.getByTestId('festival-decorations')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('failed save preserves the previous decoration', async ({ page }) => {
  settings.festivalTheme = 'diwali'; failSave = true;
  await page.goto('/admin/settings');
  await expect(page.getByText('Diwali active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply Holi decorations' }).click();
  await expect(page.getByRole('alert')).toContainText('Please retry');
  await expect(page.getByText('Diwali active', { exact: true })).toBeVisible();
  failSave = false;
  await page.getByRole('button', { name: 'Apply Holi decorations' }).click();
  await expect(page.getByText('Holi active', { exact: true })).toBeVisible();
});

test('Diwali fireworks and lamps stay visible on phones, landscape and desktop without blocking shopping', async ({ page }) => {
  settings.festivalTheme = 'diwali';
  settings.storePhone = '+919999999999';
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 767, height: 1024 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto('/products');
    const fireworks = page.getByTestId('diwali-fireworks');
    await expect(fireworks).toBeVisible();
    const compact = size.width <= 767 || size.height <= 500;
    expect(await fireworks.locator('.diwali-firework').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length)).toBe(compact ? 3 : 6);
    const burst = fireworks.locator('.diwali-firework').first();
    expect(await burst.locator('.diwali-firework-spark').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').length)).toBe(compact ? 16 : 24);
    // Inspect a real animation frame without a timing-dependent sleep.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await fireworks.evaluate(async node => {
      const animations = [...node.querySelectorAll('*')].flatMap(element => element.getAnimations());
      animations.forEach(animation => animation.pause());
      await Promise.all(animations.map(animation => animation.ready));
      animations.forEach(animation => { animation.currentTime = 2800; });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const spark = await burst.locator('.diwali-firework-spark').first().evaluate(node => {
      const style = getComputedStyle(node);
      const transform = new DOMMatrixReadOnly(style.transform);
      return { opacity: Number(style.opacity), distance: Math.hypot(transform.m41, transform.m42), height: parseFloat(style.height), pointerEvents: style.pointerEvents };
    });
    expect(spark.opacity).toBeGreaterThan(.8);
    expect(spark.height).toBeGreaterThanOrEqual(13);
    expect(spark.distance).toBeGreaterThan(5);
    expect(spark.pointerEvents).toBe('none');
    await expect(burst.locator('.diwali-firework-spark').first()).toBeInViewport();
    const decorations = page.getByTestId('festival-decorations');
    await expect(decorations.locator('.diwali-lamp-cluster-left [data-motif="candle"]').filter({ visible: true }).first()).toBeVisible();
    await expect(decorations.locator('[data-motif="fountain"]').filter({ visible: true })).toHaveCount(size.width < 768 && size.height <= 650 ? 0 : 1);
    for (const cluster of await decorations.locator('.diwali-lamp-cluster').all()) {
      await expect(cluster.locator('[data-motif="diya"]').filter({ visible: true }).first()).toBeInViewport();
      const lamps = (await cluster.locator('.diwali-lamps-layout').filter({ visible: true }).boundingBox())!;
      expect(lamps.x + lamps.width).toBeLessThanOrEqual(size.width);
      if (size.width < 768) {
        const nav = (await page.getByRole('navigation', { name: 'Primary mobile navigation' }).boundingBox())!;
        expect(lamps.y + lamps.height).toBeLessThan(nav.y);
      }
    }
    const rightLamps = (await decorations.locator('.diwali-lamp-cluster-right .diwali-lamps-layout').filter({ visible: true }).boundingBox())!;
    const contact = page.getByRole('link', { name: 'Chat with Brajmart on WhatsApp' });
    const contactBox = (await contact.boundingBox())!;
    expect(rightLamps.x + rightLamps.width < contactBox.x || rightLamps.y + rightLamps.height < contactBox.y).toBe(true);
    await noOverflow(page);
    await page.screenshot({ path: `.test-results/diwali-fireworks-${size.width}x${size.height}.png` });
    if (size.width < 600) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await expect(page.getByRole('link', { name: 'All Products', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
    }
  }
});

test('Diwali decoration follows every storefront route and keeps payment pages calm', async ({ page }) => {
  settings.festivalTheme = 'diwali';
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/products', '/blog', '/cart', '/wishlist', '/contact', '/search?q=Tulsi', '/thank-you']) {
    await page.goto(path);
    const decor = page.getByTestId('festival-decorations');
    await expect(decor).toBeVisible();
    await expect(decor.locator('[data-motif="diya"]').filter({ visible: true })).toHaveCount(4);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(decor.getByTestId('diwali-fireworks')).toHaveCount(path === '/thank-you' ? 0 : 1);
    await noOverflow(page);
  }
  // Reach checkout through the UI: an empty cart correctly redirects to /cart.
  // This product is confined to the isolated browser fixture, never the catalog.
  await page.route('**/api/products**', route => route.fulfill({ json: [{
    id: 'festival-layout-fixture', name: 'Diwali layout test item', slug: 'diwali-layout-test-item',
    price: 199, originalPrice: 199, category: 'Accessories', image: '/placeholder.svg',
    rating: 0, reviewCount: 0, inStock: true, stockQuantity: 5, reservedQuantity: 0,
  }] }));
  await page.goto('/products');
  await page.getByRole('button', { name: 'Buy Now: Diwali layout test item', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByTestId('festival-decorations')).toHaveClass(/festival-quiet/);
  await expect(page.getByTestId('diwali-fireworks')).toHaveCount(0);
  await expect(page.locator('.diwali-lamp-cluster-left')).toBeVisible();
  await noOverflow(page);
});

test('rockets visibly rise before bursting and print output omits decorations', async ({ page }) => {
  settings.festivalTheme = 'diwali';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products');
  const fireworks = page.getByTestId('diwali-fireworks');
  await expect(fireworks).toBeVisible();
  const rocket = fireworks.locator('.diwali-firework-rocket').first();
  await rocket.evaluate(async node => {
    const [animation] = node.getAnimations();
    animation.pause();
    await animation.ready;
    animation.currentTime = 700;
  });
  expect(await rocket.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1);
  await expect(rocket).toBeInViewport();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('festival-decorations')).toBeHidden();
  await expect(page.getByTestId('festival-toran')).toBeHidden();
});

test('small-phone wishes have large touch targets and fireworks respect reduced motion', async ({ page }) => {
  settings.festivalTheme = 'diwali';
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(wishes(page, 'Diwali')).toBeVisible();
  const close = page.getByRole('button', { name: 'Close festival wishes' });
  const box = await close.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await page.getByTestId('diwali-fireworks').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none'))).toBe(true);
  const dialog = await wishes(page, 'Diwali').boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(12);
  expect(dialog!.y).toBeGreaterThanOrEqual(12);
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(568 - 12);
  await noOverflow(page);
  await page.screenshot({ path: '.test-results/diwali-wishes-small-phone.png' });
  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByTestId('diwali-fireworks')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await expect(wishes(page, 'Diwali')).toBeVisible();
  const landscapeDialog = await wishes(page, 'Diwali').boundingBox();
  expect(landscapeDialog!.y).toBeGreaterThanOrEqual(12);
  expect(landscapeDialog!.y + landscapeDialog!.height).toBeLessThanOrEqual(390 - 12);
  await expect(page.getByRole('button', { name: 'Close festival wishes' })).toBeFocused();
  await page.getByRole('button', { name: 'Close festival wishes' }).click();
  await page.goto('/thank-you');
  await expect(page.getByTestId('festival-decorations')).toBeVisible();
  await expect(page.getByTestId('diwali-fireworks')).toHaveCount(0);
});
