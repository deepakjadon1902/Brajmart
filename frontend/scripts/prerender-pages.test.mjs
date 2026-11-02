import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { slugify } from './catalog-validation.mjs';

// These checks use real catalog snapshots embedded by the completed production build.
const dist = path.resolve('dist');
const site = 'https://www.brajmart.com';
const readPage = route => readFile(path.join(dist, route, 'index.html'), 'utf8');
const initialData = html => {
  const match = html.match(/window\.__BRAJMART_INITIAL_DATA__=([\s\S]*?);<\/script>/);
  assert.ok(match, 'Prerender must include the hydration snapshot');
  return JSON.parse(match[1]);
};
const catalog = initialData(await readPage('products'));
const schemas = html => [...html.matchAll(/<script\b(?=[^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]));
const assertHead = (html, route) => {
  assert.match(html, /<h1\b/i, route);
  assert.match(html, /<title\b[^>]*>[^<]+<\/title>/i, route);
  assert.ok(!html.includes('<div id="root"></div>'), `Empty SSR root for ${route}`);
  const canonicals = [...html.matchAll(/<link\b(?=[^>]*rel="canonical")[^>]*>/gi)];
  assert.equal(canonicals.length, 1, `Canonical count for ${route}`);
  assert.equal(canonicals[0][0].match(/href="([^"]+)"/)[1], `${site}${route}`, route);
  return schemas(html);
};

test('all live category and subcategory pages preserve canonical URLs, schema and matching products', async () => {
  const sitemap = await readFile(path.join(dist, 'sitemap-categories.xml'), 'utf8');
  let checked = 0;
  for (const category of catalog.categories) {
    const root = `/category/${slugify(category.name)}`;
    for (const [route, subcategory] of [[root, null], ...(category.subcategories || []).map(sub => [`${root}/${slugify(sub.name)}`, sub])]) {
      const html = await readPage(route);
      const collection = assertHead(html, route).find(schema => schema['@type'] === 'CollectionPage');
      assert.ok(collection, `CollectionPage schema for ${route}`);
      assert.ok(sitemap.includes(`<loc>${site}${route}</loc>`), `Missing sitemap entry: ${route}`);
      const expected = catalog.products.filter(product => slugify(product.category) === slugify(category.name)
        && (!subcategory || slugify(product.subcategory) === slugify(subcategory.name)));
      for (const item of collection.mainEntity.itemListElement) {
        assert.ok(expected.some(product => item.url === `${site}/product/${product.slug}`), `Wrong category product on ${route}: ${item.url}`);
      }
      if (expected.length) assert.ok(collection.mainEntity.itemListElement.length, `Missing products on ${route}`);
      checked++;
    }
  }
  assert.ok(checked >= catalog.categories.length);
});

test('all live product pages preserve product content, schema, hydration and sitemap URLs', async () => {
  const sitemap = await readFile(path.join(dist, 'sitemap-products.xml'), 'utf8');
  for (const product of catalog.products) {
    const route = `/product/${slugify(product.slug || product.name)}`;
    const html = await readPage(route);
    const schema = assertHead(html, route).find(item => item['@type'] === 'Product');
    assert.ok(schema, `Product schema for ${route} (id=${product.id})`);
    assert.equal(schema.name, product.name, route);
    assert.ok(initialData(html).products.some(entry => entry.id === product.id), `Missing hydration product: ${route}`);
    assert.ok(sitemap.includes(`<loc>${site}${route}</loc>`), `Missing sitemap entry: ${route}`);
  }
});

test('the built SSR entry renders a real category and product with their original canonical URLs', async () => {
  const { render } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);
  const category = catalog.categories.find(entry => catalog.products.some(product => slugify(product.category) === slugify(entry.name)));
  const product = catalog.products.find(entry => slugify(entry.category) === slugify(category.name));
  for (const route of [`/category/${slugify(category.name)}`, `/product/${slugify(product.slug || product.name)}`]) {
    const { appHtml, head } = await render(route, { ...catalog, products: [product] });
    assertHead(`${head}${appHtml}`, route);
  }
});
