const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../src/lib/db');
const { getJwtSecret } = require('../src/middleware/auth');
let state;

const makeReview = (overrides = {}) => ({
  id: 9, product_id: 505, user_id: null, order_id: null, rating: 5,
  title: 'Good quality', body: 'The product arrived in excellent condition.',
  status: 'APPROVED', is_verified_purchase: 0, reviewer_type: 'GUEST',
  guest_name: 'Test Customer', guest_email: 'private@example.invalid',
  created_at: '2026-11-01T10:00:00.000Z', ...overrides,
});
const query = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  state.queries.push({ sql, params });
  if (state.failReads) throw new Error('Simulated database outage');
  if (sql.includes('FROM products')) return [{ id: 505, archived_at: null }];
  if (sql.includes('FROM users')) return [{ id: 8, email: 'user@example.invalid', status: 'active' }];
  if (sql.includes('FROM orders')) return [{ id: 10339, items: '[{"productId":"505"}]', status: 'delivered' }];
  if (sql.includes('AS review_count')) return [{ review_count: state.reviews.filter(r => r.status === 'APPROVED').length, average_rating: 5, rating_5: 1 }];
  if (sql.includes('COUNT(*) AS count')) return [{ count: state.reviews.length, average_rating: 5 }];
  if (sql.includes('FROM reviews r') && sql.includes("r.status = 'APPROVED'")) return state.reviews.filter(r => r.status === 'APPROVED');
  if (sql.includes('WHERE id = ?') || sql.includes('WHERE r.id = ?')) return state.reviews.filter(r => r.id === Number(params[0]));
  if (sql.includes('FROM reviews') && (sql.includes('order_id = ?') || sql.includes('order_id IS NULL'))) return [];
  if (sql.includes('FROM reviews')) return state.reviews;
  throw new Error(`Unexpected query: ${sql}`);
};
const execute = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  state.writes.push({ sql, params });
  if (sql.includes('INSERT INTO reviews')) {
    const [product_id, user_id, order_id, rating, title, body, verified, reviewer_type, guest_name, guest_email] = params;
    state.reviews.push(makeReview({ id: 10, product_id, user_id, order_id, rating, title, body, status: 'PENDING', is_verified_purchase: verified, reviewer_type, guest_name, guest_email }));
    return { insertId: 10, affectedRows: 1 };
  }
  if (sql.includes('UPDATE reviews SET status')) state.reviews.find(r => r.id === Number(params.at(-1))).status = params[0];
  return { affectedRows: 1 };
};
db.isDbConnected = () => state.connected;
db.dbQuery = query;
db.dbExecute = execute;
db.withDbTransaction = async work => work({ execute: async (sql, params) => {
  db.assertNoRuntimeDdl(sql);
  if (/^\s*SELECT/i.test(sql)) return [await query(sql, params)];
  return [await execute(sql, params)];
} });

const app = express();
app.use(express.json());
app.use('/api/reviews', require('../src/routes/reviews').default);
let server;
let baseUrl;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/reviews`;
});
after(async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => { state = { connected: true, failReads: false, reviews: [makeReview(), makeReview({ id: 20, status: 'PENDING' })], writes: [], queries: [] }; });
const headers = (role = 'admin') => ({ Authorization: `Bearer ${jwt.sign({ id: '8', role, email: 'user@example.invalid' }, getJwtSecret())}` });
const request = (route, options) => fetch(`${baseUrl}${route}`, options);

test('public product reviews load with DDL forbidden and expose approved feedback only', async () => {
  const response = await request('/products/505');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.summary.reviewCount, 1);
  assert.equal(data.reviews.length, 1);
  assert.equal(data.reviews[0].customerName, 'Test C.');
  assert.equal(data.reviews[0].isVerifiedPurchase, false);
  assert.equal(data.reviews[0].customerEmail, undefined);
  assert.equal(JSON.stringify(data).includes('private@example.invalid'), false);
  assert.deepEqual(state.writes, []);
});

test('guest review eligibility works without creating tables', async () => {
  const response = await request('/eligibility/505');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).canReview, true);
  assert.deepEqual(state.writes, []);
});

test('guest submission stays pending and cannot claim verified-purchase status', async () => {
  const response = await request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: 505, rating: 5, body: 'The product arrived in good condition.', isVerifiedPurchase: true }) });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.review.status, 'PENDING');
  assert.equal(data.review.isVerifiedPurchase, false);
  assert.equal(data.review.reviewerType, 'GUEST');
  assert.equal(state.writes.length, 1);
});

test('a delivered authenticated purchase retains verified-review eligibility', async () => {
  const response = await request('/eligibility/505', { headers: headers('user') });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).isVerifiedPurchase, true);
  assert.deepEqual(state.writes, []);
});

test('admin moderation reads and status updates work with the runtime DDL guard active', async () => {
  const listing = await request('/admin', { headers: headers() });
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).items.length, 2);
  const response = await request('/admin/20/status', { method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).review.status, 'APPROVED');
  assert.ok(state.writes.some(({ sql }) => sql.includes('UPDATE products SET rating')));
  assert.ok(state.writes.some(({ sql }) => sql.includes('INSERT INTO admin_audit_logs')));
});

test('moderation remains restricted to authenticated admins', async () => {
  assert.equal((await request('/admin')).status, 401);
  assert.equal((await request('/admin', { headers: headers('user') })).status, 403);
  assert.deepEqual(state.queries, []);
  assert.deepEqual(state.writes, []);
});

test('review validation and genuine database failures remain visible', async () => {
  assert.equal((await request('/products/not-a-number')).status, 400);
  state.failReads = true;
  const response = await request('/products/505');
  assert.equal(response.status, 500);
  assert.equal((await response.json()).message, 'Failed to load reviews');
  state.connected = false;
  assert.equal((await request('/products/505')).status, 503);
  assert.deepEqual(state.writes, []);
});
