const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { EventEmitter } = require('node:events');
const jwt = require('jsonwebtoken');
const db = require('../src/lib/db');
let state;
const category = (id) => Number(id) === 2 ? 'Books' : 'Prasadam';
const product = (id, categoryId = 1) => ({ id, name: `Product ${id}`, slug: `product-${id}`, price: 100, image: '/logo.png', category_id: categoryId, category: category(categoryId), tags: '[]', show_on_home: 0, home_position: null, in_stock: 1, reserved_quantity: 0, archived_at: null });
const selected = (id) => state.products.find((row) => String(row.id) === String(id));
db.isDbConnected = () => true;
db.dbQuery = async (sql, params = []) => {
  if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return (params.length ? params : ['cod_enabled']).map((COLUMN_NAME) => ({ COLUMN_NAME }));
  if (sql.includes('FROM categories WHERE name')) return [{ id: params[0] === 'Books' ? 2 : 1 }];
  if (sql.includes('FROM products')) {
    if (sql.includes('WHERE id = ?') || sql.includes('WHERE p.id = ?')) return selected(params[0]) ? [{ ...selected(params[0]), category_name: category(selected(params[0]).category_id) }] : [];
    return state.products.filter((row) => !row.archived_at).map((row) => ({ ...row, category_name: category(row.category_id) }));
  }
  throw new Error(`Unexpected query: ${sql}`);
};
db.dbExecute = async () => ({ affectedRows: 1 });
db.withDbTransaction = async (work) => {
  const snapshot = structuredClone(state.products);
  state.transactions++;
  const connection = { execute: async (sql, params = []) => {
    state.sql.push({ sql, params });
    if (sql.startsWith('SELECT id FROM categories')) return [[{ id: params[0] }]];
    if (sql.startsWith('SELECT * FROM products')) return [[selected(params[0])].filter(Boolean)];
    if (sql.startsWith('SELECT id, home_position FROM products')) return [state.products.filter((row) => row.category_id === params[0] && !row.archived_at)];
    if (sql.startsWith('UPDATE products SET home_position = NULL')) {
      for (const row of state.products) if (row.category_id === params[0] && row.home_position === params[1] && String(row.id) !== String(params[2])) { row.home_position = null; row.show_on_home = 0; }
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE products SET')) {
      if (state.failWrite) throw new Error('Simulated product write failure');
      const row = selected(params.at(-1));
      const assignments = sql.split(' SET ')[1].split(' WHERE ')[0].split(', ');
      let index = 0;
      for (const assignment of assignments) if (assignment.includes('= ?')) row[assignment.split(' = ')[0].replaceAll('`', '')] = params[index++];
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO products')) {
      const columns = sql.match(/products \((.+)\) VALUES/)[1].split(', ').map((column) => column.replaceAll('`', ''));
      const row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
      row.id = 20; row.home_position = null; row.archived_at = null;
      state.products.push(row);
      return [{ insertId: 20 }];
    }
    throw new Error(`Unexpected transaction query: ${sql}`);
  } };
  try { return await work(connection); }
  catch (error) { state.products = snapshot; throw error; }
};
const router = require('../src/routes/products').default;
const { getJwtSecret } = require('../src/middleware/auth');
const { publishCatalogUpdate, streamCatalogUpdates } = require('../src/lib/catalogEvents');
async function request(method, path, body = {}, { id = '8', role = 'admin' } = {}) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]).route;
  const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  const authorization = `Bearer ${jwt.sign({ id: 'admin', role }, getJwtSecret())}`;
  const req = { body, params: { id }, query: { fresh: '1' }, header: () => authorization };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, response, () => { next = true; });
    if (!next) break;
  }
  return response;
}
beforeEach(() => { state = { products: [...Array.from({ length: 8 }, (_, i) => product(i + 1)), product(9, 2)], transactions: 0, sql: [], failWrite: false }; });

test('admin saves a numbered home position, replaces its previous selection only in that category, and list/detail responses preserve it', async () => {
  selected(2).home_position = 3; selected(2).show_on_home = 1;
  selected(9).home_position = 3; selected(9).show_on_home = 1;
  const response = await request('put', '/:id', { homePosition: 3 });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.homePosition, 3);
  assert.equal(response.body.showOnHome, true);
  assert.deepEqual(response.body.replacedHomeProductIds, ['2']);
  assert.equal(selected(2).home_position, null);
  assert.equal(selected(9).home_position, 3);
  const listing = await request('get', '/');
  assert.equal(listing.body.find((row) => row.id === '8').homePosition, 3);
  assert.match(state.sql[0].sql, /categories.*FOR UPDATE/);
});
test('Automatic releases the manual position and keeps the product in the catalog', async () => {
  selected(8).home_position = 2; selected(8).show_on_home = 1;
  const response = await request('put', '/:id', { homePosition: null });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.homePosition, null);
  assert.equal(response.body.showOnHome, false);
  assert.equal(state.products.length, 9);
});
test('invalid home positions are rejected before product mutations', async () => {
  for (const homePosition of [0, 7, 1.5, 'bad', true, [1], {}]) {
    const response = await request('put', '/:id', { homePosition });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(state.transactions, 0);
});
test('a failed product save rolls back the displaced selection too', async () => {
  selected(2).home_position = 3; selected(2).show_on_home = 1;
  state.failWrite = true;
  const response = await request('put', '/:id', { homePosition: 3 });
  assert.equal(response.statusCode, 500);
  assert.equal(selected(2).home_position, 3);
  assert.equal(selected(2).show_on_home, 1);
  assert.equal(selected(8).home_position, null);
});
test('create and full product edits persist the chosen home position', async () => {
  const response = await request('post', '/', { name: 'New Offering', slug: 'new-offering', price: 100, image: '/logo.png', categoryId: 1, category: 'Prasadam', homePosition: 6 });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.homePosition, 6);
  assert.equal(response.body.showOnHome, true);
  const edited = await request('put', '/:id', { name: 'Edited Offering', description: 'New description', homePosition: 1 }, { id: '20' });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.body.name, 'Edited Offering');
  assert.equal(edited.body.homePosition, 1);
});
test('moving a selected product to another category replaces that category’s selection with ordered category locks', async () => {
  selected(8).home_position = 3; selected(8).show_on_home = 1;
  selected(9).home_position = 3; selected(9).show_on_home = 1;
  const response = await request('put', '/:id', { categoryId: 2, category: 'Books' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.homePosition, 3);
  assert.equal(selected(9).home_position, null);
  assert.deepEqual(state.sql.filter(({ sql }) => sql.includes('categories') && sql.includes('FOR UPDATE')).map(({ params }) => params[0]), [1, 2]);
});
test('customers cannot change home placement', async () => {
  assert.equal((await request('put', '/:id', { homePosition: 1 }, { role: 'customer' })).statusCode, 403);
  assert.equal(state.transactions, 0);
});
test('catalog stream refreshes connected shoppers and removes listeners on disconnect', () => {
  const req = new EventEmitter();
  const chunks = [];
  const res = { setHeader() {}, flushHeaders() {}, write(value) { chunks.push(value); } };
  streamCatalogUpdates(req, res);
  assert.equal(chunks.length, 1);
  publishCatalogUpdate();
  assert.equal(chunks.length, 2);
  assert.match(chunks[1], /event: catalog-updated/);
  req.emit('close');
  publishCatalogUpdate();
  assert.equal(chunks.length, 2);
});
