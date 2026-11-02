const assert = require('node:assert/strict');
const { before, beforeEach, after, test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../../src/lib/db');
const previousEnv = { ...process.env };
Object.assign(process.env, { APP_ENV: 'production', NODE_ENV: 'production', JWT_SECRET: 'isolated-auth-contract-secret', SITE_URL: 'https://www.brajmart.com' });
let queries;
let writes;
let wishlist;
db.isDbConnected = () => true;
db.dbQuery = async (sql, params) => {
  queries.push({ sql, params });
  if (sql.includes('FROM wishlists')) return wishlist ? [{ id: 1, user_id: params[0], items: JSON.stringify(wishlist) }] : [];
  if (sql.includes('FROM users')) return [{ id: params[0], name: 'Contract User', email: 'contract@example.invalid', role: 'user', status: 'active', is_verified: 1 }];
  throw new Error(`Unexpected integration query: ${sql}`);
};
db.dbExecute = async (sql, params) => {
  db.assertNoRuntimeDdl(sql);
  writes.push({ sql, params });
  if (sql.startsWith('INSERT INTO wishlists')) wishlist = JSON.parse(params[1]);
  else if (sql.startsWith('UPDATE wishlists')) wishlist = JSON.parse(params[0]);
  else throw new Error('Unexpected integration write');
  return { affectedRows: 1 };
};

// This receiver exercises the real server's raw-body parser only. It cannot
// contact a gateway or mark a payment paid. All persistence above is in memory.
const receiver = express.Router();
receiver.post('/webhook', (req, res) => res.json({ rawBody: req.rawBody }));
const moduleId = require.resolve('../../src/routes/razorpay');
require.cache[moduleId] = { id: moduleId, filename: moduleId, loaded: true, exports: { __esModule: true, default: receiver } };
const app = require('../../src/server').default;
const { auth, optionalAuth, adminOnly } = require('../../src/middleware/auth');
app.post('/__contract/:id', auth, (req, res) => res.json({ body: req.body, params: req.params, query: req.query, user: req.user }));
app.get('/__optional', optionalAuth, (req, res) => res.json({ user: req.user || null }));
app.get('/__admin', auth, adminOnly, (_req, res) => res.json({ ok: true }));
let server;
let origin;
const token = (claims = {}, options = {}) => jwt.sign({ id: '17', email: 'contract@example.invalid', role: 'user', ...claims }, process.env.JWT_SECRET, { expiresIn: '5m', ...options });
const headers = bearer => bearer ? { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => { queries = []; writes = []; wishlist = null; });
after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
});

for (const [name, bearer] of [
  ['missing', () => ''], ['invalid', () => 'invalid-token'], ['expired', () => token({}, { expiresIn: -1 })],
]) {
  test(`${name} authentication rejects wishlist reads before any database query`, async () => {
    const response = await fetch(`${origin}/api/wishlist`, { headers: headers(bearer()) });
    assert.equal(response.status, 401);
    assert.equal(queries.length, 0);
    assert.equal(writes.length, 0);
  });
}

test('authenticated requests retain body, params, query, identity and password-reset claims', async () => {
  const response = await fetch(`${origin}/__contract/42?reason=reviewed`, {
    method: 'POST', headers: headers(token({ pwdReset: true })), body: JSON.stringify({ items: ['contract-item'] }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.body, { items: ['contract-item'] });
  assert.deepEqual(data.params, { id: '42' });
  assert.deepEqual(data.query, { reason: 'reviewed' });
  assert.equal(data.user.id, '17');
  assert.equal(data.user.pwdReset, true);
});

test('optional authentication preserves anonymous requests and resolves valid identities', async () => {
  for (const bearer of ['', 'invalid-token']) {
    const response = await fetch(`${origin}/__optional`, { headers: headers(bearer) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: null });
  }
  const response = await fetch(`${origin}/__optional`, { headers: headers(token()) });
  assert.equal((await response.json()).user.id, '17');
});

test('admin authorization rejects normal users and allows signed admin claims', async () => {
  assert.equal((await fetch(`${origin}/__admin`, { headers: headers(token()) })).status, 403);
  assert.equal((await fetch(`${origin}/__admin`, { headers: headers(token({ role: 'admin' })) })).status, 200);
  assert.equal(queries.length, 0);
});

test('wishlist body updates use the authenticated identity, followed by read and clear', async () => {
  const items = [{ productId: '101' }];
  const response = await fetch(`${origin}/api/wishlist`, { method: 'PUT', headers: headers(token()), body: JSON.stringify({ userId: '999', items }) });
  assert.equal(response.status, 200);
  assert.equal(writes[0].params[0], '17');
  assert.deepEqual((await response.json()).items, items);
  const read = await fetch(`${origin}/api/wishlist`, { headers: headers(token()) });
  assert.deepEqual((await read.json()).items, items);
  const cleared = await fetch(`${origin}/api/wishlist`, { method: 'DELETE', headers: headers(token()) });
  assert.equal(cleared.status, 200);
  assert.deepEqual((await cleared.json()).items, []);
});

test('the actual users route retains admin-only access and typed path parameters', async () => {
  assert.equal((await fetch(`${origin}/api/users/42`, { headers: headers(token()) })).status, 403);
  assert.equal(queries.length, 0);
  const response = await fetch(`${origin}/api/users/42`, { headers: headers(token({ role: 'admin' })) });
  assert.equal(response.status, 200);
  assert.equal((await response.json())._id, '42');
  assert.deepEqual(queries[0].params, ['42']);
});

test('raw webhook bytes remain unchanged through the typed JSON parser', async () => {
  const raw = ' { "event" : "isolated-parser-contract" } ';
  const response = await fetch(`${origin}/api/razorpay/webhook`, { method: 'POST', headers: headers(), body: raw });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { rawBody: raw });
  assert.equal(writes.length, 0);
});

test('CORS failures retain the existing HTTP status and response message', async () => {
  const response = await fetch(`${origin}/api/health`, { headers: { Origin: 'https://untrusted.example.invalid' } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'CORS blocked origin: https://untrusted.example.invalid' });
});

test('health and legacy redirects retain their existing API contracts', async () => {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const redirect = await fetch(`${origin}/product-tag/best-selling-products`, { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('Location'), '/products?tag=bestseller');
});
