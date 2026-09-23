import { chromium } from '@playwright/test';

const baseUrl = process.env.PHASE6_BASE_URL || 'http://127.0.0.1:4178';
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
const routes = [
  '/',
  '/products',
  '/about',
  '/categories',
  '/category/accessories',
  '/product/2-round-tulsi-kanthi-mala-natural-tulsi-beads',
];
const browser = await chromium.launch({ headless: true });
const results = { routes: [], responsive: [], commerce: {} };

for (const route of routes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(750);
  results.routes.push({
    route,
    errors,
    main: await page.locator('main#main-content').count(),
    title: await page.title(),
    cartDrawerLoaded: (await page.locator('script[src*="CartDrawer"]').count()) > 0
      || (await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('CartDrawer')))),
  });
  await context.close();
}

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(500);
  results.responsive.push(await page.evaluate(({ width, errors }) => ({
    width,
    errors,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    cards: document.querySelectorAll('.product-card').length,
    sections: document.querySelectorAll('main#main-content > *').length,
    main: Boolean(document.querySelector('main#main-content')),
    overflowSources: [...document.querySelectorAll('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, className: String(element.className || '').slice(0, 120), left: rect.left, right: rect.right };
      })
      .filter((element) => element.left < -1 || element.right > document.documentElement.clientWidth + 1)
      .slice(0, 8),
  }), { width, errors }));
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(750);
  const before = await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('CartDrawer')));
  const addButton = page.locator('.product-card .add-to-cart-btn:visible').first();
  const started = await page.evaluate(() => performance.now());
  await addButton.click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 10_000 });
  const total = Math.round((await page.evaluate(() => performance.now())) - started);
  const after = await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('CartDrawer')));
  results.commerce = { cartDrawerLoadedBefore: before, cartDrawerLoadedAfter: after, firstCartOpenMs: total, dialogVisible: true };
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
