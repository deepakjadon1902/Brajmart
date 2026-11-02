import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { slugify } from './catalog-validation.mjs';

// Reuse the real, validated catalog fetched by the completed production build.
// Theme changes below are confined to renderer memory, never the live API.
const catalogHtml = await readFile('dist/products/index.html', 'utf8');
const snapshot = catalogHtml.match(/window\.__BRAJMART_INITIAL_DATA__=([\s\S]*?);<\/script>/);
assert.ok(snapshot, 'A completed production build with its hydration snapshot is required');
const catalog = JSON.parse(snapshot[1]);
const { render } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
const category = catalog.categories.find(entry => catalog.products.some(product => slugify(product.category) === slugify(entry.name)));
const product = catalog.products.find(entry => slugify(entry.category) === slugify(category.name));
const routes = ['/', `/category/${slugify(category.name)}`, `/product/${slugify(product.slug || product.name)}`];

test('both festivals render in the built SSR application without changing catalog metadata or canonical URLs', async () => {
  for (const route of routes) {
    const baseline = await render(route, { ...catalog, settings: { ...catalog.settings, festivalTheme: 'none' } });
    assert.ok(!baseline.appHtml.includes('data-testid="festival-toran"'));
    for (const festivalTheme of ['diwali', 'holi']) {
      const result = await render(route, { ...catalog, settings: { ...catalog.settings, festivalTheme } });
      assert.match(result.appHtml, new RegExp(`festival-toran festival-${festivalTheme}`));
      assert.match(result.appHtml, new RegExp(`festival-footer-ornaments festival-${festivalTheme}`));
      assert.match(result.appHtml, new RegExp(`festival-decorations festival-${festivalTheme}`));
      assert.equal(result.appHtml.includes('data-testid="diwali-fireworks"'), festivalTheme === 'diwali');
      assert.ok(!result.appHtml.includes('festival-banner'));
      assert.ok(!result.appHtml.includes('role="dialog"'), 'Greeting must open after hydration, preserving indexable content');
      assert.equal(result.head, baseline.head, `Metadata changed for ${festivalTheme} on ${route}`);
    }
  }
});

test('an older backend response resets the previous render theme to off', async () => {
  await render('/', { ...catalog, settings: { ...catalog.settings, festivalTheme: 'holi' } });
  const legacy = { ...catalog.settings };
  delete legacy.festivalTheme;
  const result = await render('/', { ...catalog, settings: legacy });
  assert.ok(!result.appHtml.includes('data-testid="festival-toran"'));
  assert.ok(!result.appHtml.includes('data-testid="festival-banner"'));
});
