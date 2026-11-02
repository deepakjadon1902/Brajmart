const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const db = require('../src/lib/db');

const product = {
  id: 11, name: 'Tulsi Mala', slug: 'tulsi-mala', price: 100, original_price: null,
  image: '/logo.png', images: '["/logo.png"]', category_id: 2, subcategory_id: 7,
  category_name: 'Accessories', subcategory_name: 'Malas', in_stock: 1,
  cod_enabled: 0, category_cod_enabled: 0, archived_at: null,
};
const category = { id: 2, name: 'Accessories', product_count: 1, cod_enabled: 0, archived_at: null };
const subcategory = { id: 7, category_id: 2, name: 'Malas', archived_at: null };
let connected = true;
let queryError = null;
let queries = [];
let writes = [];

db.isDbConnected = () => connected;
db.dbQuery = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  assert.match(sql.trim(), /^SELECT\b/i, 'catalog reads must use SELECT only');
  queries.push(sql);
  if (queryError) throw queryError;
  if (/FROM products p/.test(sql)) return params[0] === 'missing' ? [] : [product];
  if (/FROM categories\b/.test(sql)) return [category];
  if (/FROM subcategories\b/.test(sql)) return [subcategory];
  throw new Error(`Unexpected catalog query: ${sql}`);
};
db.dbExecute = async (sql) => {
  writes.push(sql);
  // Keep the real runtime DDL guard active: stubbing it away hid the deployment failure.
  db.assertNoRuntimeDdl(sql);
  throw new Error('Catalog GET attempted a database write');
};

const app = express();
app.use('/api/products', require('../src/routes/products').default);
app.use('/api/categories', require('../src/routes/categories').default);
let server;
let baseUrl;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
beforeEach(() => {
  connected = true;
  queryError = null;
  queries = [];
  writes = [];
});

for (const view of ['list', 'detail']) {
  test(`public product ${view} returns catalog data with runtime writes forbidden`, async () => {
    const response = await fetch(`${baseUrl}/api/products?view=${view}&fresh=1`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].slug, product.slug);
    assert.equal(data[0].categoryId, category.id);
    assert.deepEqual(data[0].images, ['/logo.png']);
    assert.equal(queries.length, 1);
    assert.deepEqual(writes, []);
  });
}

test('public product detail and missing-product responses do not attempt schema repair', async () => {
  const response = await fetch(`${baseUrl}/api/products/tulsi-mala`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, String(product.id));
  const missing = await fetch(`${baseUrl}/api/products/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(writes, []);
});

test('public categories include subcategories without creating tables or backfilling products', async () => {
  const response = await fetch(`${baseUrl}/api/categories?fresh=1`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data[0]._id, String(category.id));
  assert.equal(data[0].subcategories[0]._id, String(subcategory.id));
  assert.equal(queries.length, 2);
  assert.deepEqual(writes, []);
});

test('public subcategory reads work with the runtime DDL guard enabled', async () => {
  const response = await fetch(`${baseUrl}/api/categories/2/subcategories`);
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0].categoryId, String(category.id));
  assert.equal(queries.length, 1);
  assert.deepEqual(writes, []);
});

test('catalog endpoints report database unavailability without attempting any SQL', async () => {
  connected = false;
  for (const route of ['/products?fresh=1', '/products/tulsi-mala', '/categories?fresh=1', '/categories/2/subcategories']) {
    const response = await fetch(`${baseUrl}/api${route}`);
    assert.equal(response.status, 503, route);
  }
  assert.deepEqual(queries, []);
  assert.deepEqual(writes, []);
});

test('a missing deployed schema remains an error and never triggers runtime migration', async () => {
  queryError = Object.assign(new Error('Required catalog schema is missing'), { code: 'ER_NO_SUCH_TABLE' });
  for (const route of ['/products?view=detail&fresh=1', '/categories?fresh=1']) {
    const response = await fetch(`${baseUrl}/api${route}`);
    assert.equal(response.status, 500, route);
    assert.equal((await response.json()).message, queryError.message);
  }
  assert.deepEqual(writes, []);
});
