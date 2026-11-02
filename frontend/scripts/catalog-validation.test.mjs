import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSeoCatalog } from './catalog-validation.mjs';
import { sanitizeBuildDiagnostic } from './seo-diagnostics.mjs';
import { renderCatalogPage } from './prerender-diagnostics.mjs';

const valid = () => ({
  products: [{ id: '11', name: 'Tulsi Mala', slug: 'tulsi-mala', category: 'Accessories' }],
  categories: [{ _id: '8', name: 'Accessories', subcategories: [{ _id: '7', name: 'Malas' }] }],
  blogs: [],
});

test('valid catalogs and categories with no products retain their established routes', () => {
  const data = valid();
  data.categories.push({ _id: '9', name: 'Empty Category' });
  assert.deepEqual(validateSeoCatalog(data), { products: 1, categories: 2, blogs: 0, catalogRoutes: 4 });
});

test('a malformed API envelope is identified before normalization can hide it', () => {
  assert.throws(() => validateSeoCatalog({ ...valid(), categories: { data: [] } }), /\/categories expected a JSON array; received object/);
});

test('an empty catalog continues to stop releases', () => {
  assert.throws(() => validateSeoCatalog({ ...valid(), categories: [] }), /no products or categories \(products=1, categories=0\)/);
});

test('a null category identifies its exact array index', () => {
  const data = valid();
  data.categories.push(null);
  assert.throws(() => validateSeoCatalog(data), /categories\[1\] type=null: expected an object/);
});

test('a malformed category identifies its ID and field', () => {
  const data = valid();
  data.categories[0].name = 42;
  assert.throws(() => validateSeoCatalog(data), /categories\[0\] id="8".*name must be a non-empty string/);
});

test('malformed subcategories identify the parent category and subcategory index', () => {
  const data = valid();
  data.categories[0].subcategories[0].name = '';
  assert.throws(() => validateSeoCatalog(data), /categories\[0\].subcategories\[0\] id="7".*name must be a non-empty string/);
});

test('empty slugs cannot be silently dropped from prerendering', () => {
  const data = valid();
  data.categories[0].name = '!!!';
  assert.throws(() => validateSeoCatalog(data), /id="8".*empty category slug/);
});

test('slug collisions identify both entries without changing the slug mapping', () => {
  const data = valid();
  data.categories.push({ id: '10', name: 'ACCESSORIES' });
  assert.throws(() => validateSeoCatalog(data), /categories\[1\].*id="10".*duplicate route \/category\/accessories.*categories\[0\].*id="8"/);
});

test('malformed product slugs identify the exact product', () => {
  const data = valid();
  data.products[0].slug = { broken: true };
  assert.throws(() => validateSeoCatalog(data), /products\[0\] id="11".*slug must be a string/);
});

test('diagnostics remove URL credentials, query tokens, bearer tokens, and known secrets', () => {
  const message = sanitizeBuildDiagnostic('https://user:password123@example.invalid/api?token=privateValue#secret Bearer abc123 password=secret456 value=envSecret789', { TEST_SECRET: 'envSecret789' });
  for (const secret of ['user:', 'password123', 'privateValue', 'abc123', 'secret456', 'envSecret789']) assert.ok(!message.includes(secret), secret);
  assert.ok(message.includes('https://example.invalid/api'));
});

test('prerender exceptions identify the exact category or product and redact secrets', async () => {
  const data = valid();
  for (const [route, identity] of [
    ['/category/accessories/malas', /categories\[0\].subcategories\[0\] id="7"/],
    ['/product/tulsi-mala', /products\[0\] id="11"/],
  ]) {
    await assert.rejects(renderCatalogPage(async () => { throw new Error('SSR failed password=secret123'); }, route, data, data), error => {
      assert.match(error.message, identity);
      assert.ok(error.message.includes(route));
      assert.ok(!error.message.includes('secret123'));
      return true;
    });
  }
});

test('an empty SSR result cannot produce an empty indexable document', async () => {
  await assert.rejects(renderCatalogPage(async () => ({ appHtml: '' }), '/product/tulsi-mala', valid(), valid()), /products\[0\].*SSR produced empty HTML/);
});
