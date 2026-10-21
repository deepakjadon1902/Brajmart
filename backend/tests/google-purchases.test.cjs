const assert = require('node:assert/strict');
const { test, beforeEach, after } = require('node:test');
const db = require('../src/lib/db');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
let state;
db.isDbConnected = () => state.connected;
db.dbQuery = async (sql) => {
  if (sql.includes('FROM orders')) return state.order ? [state.order] : [];
  if (sql.includes('FROM payment_status ps')) return state.paidRows;
  if (sql.includes('FROM google_order_contexts')) return state.context ? [state.context] : [];
  if (sql.includes('FROM google_purchase_events')) return state.event ? [state.event] : [];
  throw new Error(`Unexpected query ${sql}`);
};
db.dbExecute = async (sql, params) => {
  if (sql.includes('INSERT IGNORE INTO google_purchase_events')) {
    if (state.event) return { affectedRows: 0 };
    state.event = { status: 'pending', payload: params[2] };
  } else if (sql.includes('attempts = attempts + 1')) {
    if (state.event.status !== 'failed' && !state.stalePending) return { affectedRows: 0 };
    state.event.status = 'pending';
  } else if (sql.includes("SET status = 'submitted'")) state.event.status = 'submitted';
  else if (sql.includes("SET status = 'failed'")) state.event.status = 'failed';
  else if (sql.startsWith('DELETE FROM google_order_contexts')) state.context = null;
  else if (sql.startsWith('INSERT INTO google_order_contexts')) state.context = { measurement_id: params[1], client_id: params[2], session_id: params[3] };
  return { affectedRows: 1 };
};
const { sendVerifiedGooglePurchaseForOrder, captureGoogleOrderContext, buildGooglePurchaseParams } = require('../src/lib/googlePurchases');
beforeEach(() => {
  process.env.GA4_MEASUREMENT_ID = 'G-ISOLATED'; process.env.GA4_API_SECRET = 'isolated-secret';
  process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_live_Isolated'; process.env.RAZORPAY_PLATFORM_KEY_SECRET = 'isolated-secret';
  state = {
    connected: true,
    order: { id: 42, total: 159, payment_method: 'Razorpay', items: [{ id: '101', name: 'Tulsi Mala', quantity: 1, price: 100 }] },
    paidRows: [{ token: 'order_Real42', payment_id: 'pay_Real42', transaction_id: 'pay_Real42', amount: 159, payment_amount: 159 }],
    payment: { id: 'pay_Real42', order_id: 'order_Real42', amount: 15900, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0, created_at: Math.floor(Date.now() / 1000) },
    context: { measurement_id: 'G-ISOLATED', client_id: '111.222', session_id: String(Math.floor(Date.now() / 1000)) },
    event: null, calls: [],
  };
  global.fetch = async (url, options) => {
    const target = new URL(url);
    if (target.hostname === 'api.razorpay.com') return { ok: true, json: async () => state.payment };
    assert.equal(target.hostname, 'www.google-analytics.com');
    assert.equal(target.pathname, '/mp/collect');
    assert.equal(target.searchParams.get('api_secret'), 'isolated-secret');
    state.calls.push(JSON.parse(options.body));
    if (state.networkError) throw new Error('Simulated network failure');
    return { ok: !state.httpError };
  };
});
after(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});
const send = () => sendVerifiedGooglePurchaseForOrder(42, 'pay_Real42', 'order_Real42');

test('malformed saved items are rejected without throwing or submitting a purchase', async () => {
  for (const items of [[null], [false], [123], ['invalid'], [[]]]) {
    state.order.items = items;
    assert.equal(buildGooglePurchaseParams(state.order), null);
    assert.equal((await send()).reason, 'invalid_purchase_items');
  }
  assert.equal(state.calls.length, 0);
});
test('only a captured live payment sends the server-owned order and stable transaction ID', async () => {
  assert.equal((await send()).ok, true);
  assert.equal(state.calls.length, 1);
  const payload = state.calls[0];
  assert.equal(payload.client_id, '111.222');
  assert.equal(payload.events[0].name, 'purchase');
  assert.equal(payload.events[0].params.transaction_id, '42');
  assert.equal(payload.events[0].params.value, 100);
  assert.equal(payload.events[0].params.shipping, 59);
  assert.equal(payload.events[0].params.order_total, 159);
  assert.equal(state.event.status, 'submitted');
  assert.ok(!JSON.stringify(payload).includes('isolated-secret'));
});
for (const [label, change] of [
  ['authorized', { status: 'authorized', captured: false }], ['failed', { status: 'failed' }],
  ['wrong order', { order_id: 'order_Other' }], ['wrong amount', { amount: 15899 }],
  ['wrong currency', { currency: 'USD' }], ['refunded', { amount_refunded: 1 }],
]) test(`blocks ${label} payments despite paid database rows`, async () => {
  Object.assign(state.payment, change);
  assert.equal((await send()).ok, false);
  assert.equal(state.calls.length, 0);
});
test('test mode, absent configuration, missing consent and absent orders cannot create Google purchases', async () => {
  process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_test_Isolated';
  assert.equal((await send()).ok, false);
  process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_live_Isolated';
  state.context = null; assert.equal((await send()).ok, false);
  state.order = null; assert.equal((await send()).ok, false);
  delete process.env.GA4_API_SECRET; assert.equal((await send()).reason, 'google_not_configured');
  assert.equal(state.calls.length, 0);
});
test('COD cannot create a paid online purchase event', async () => {
  state.order.payment_method = 'COD';
  assert.equal((await send()).ok, false);
  assert.equal(state.calls.length, 0);
});
test('simultaneous callbacks and later reloads submit one purchase', async () => {
  await Promise.all([send(), send(), send()]);
  await send();
  assert.equal(state.calls.length, 1);
});
test('failed delivery retries with the original transaction and client ID', async () => {
  state.networkError = true;
  assert.equal((await send()).ok, false);
  assert.equal(state.event.status, 'failed');
  state.networkError = false; state.context.client_id = '999.888';
  assert.equal((await send()).ok, true);
  assert.equal(state.calls.length, 2);
  assert.deepEqual(state.calls[1], state.calls[0]);
});
test('HTTP errors remain retryable and purchases older than 72 hours are not re-dated as new', async () => {
  state.httpError = true; await send();
  assert.equal(state.event.status, 'failed');
  state.payment.created_at -= 73 * 60 * 60;
  assert.equal((await send()).reason, 'google_event_time_out_of_range');
  assert.equal(state.calls.length, 1);
});
test('explicit consent withdrawal removes the saved analytics identity', async () => {
  await captureGoogleOrderContext(42, { googleAnalytics: { measurementId: 'G-ISOLATED', analyticsConsent: false } });
  assert.equal(state.context, null);
  assert.equal((await send()).reason, 'google_consent_or_client_id_missing');
});
test('invalid analytics identities are ignored and valid IDs are saved without customer PII', async () => {
  state.context = null;
  await captureGoogleOrderContext(42, { googleAnalytics: { measurementId: 'G-ISOLATED', analyticsConsent: true, clientId: 'email@example.com' } });
  assert.equal(state.context, null);
  await captureGoogleOrderContext(42, { googleAnalytics: { measurementId: 'G-ISOLATED', analyticsConsent: true, clientId: '123.456', sessionId: '1790000000' } });
  assert.equal(state.context.client_id, '123.456');
});
test('saved coupons reduce item revenue without negative prices on free items', () => {
  const params = buildGooglePurchaseParams({ id: 42, total: 2.99, coupon_discount: 0.01, items: [{ id: '1', quantity: 3, price: 1 }, { id: '2', quantity: 1, price: 0 }] });
  assert.equal(params.value, 2.99);
  assert.equal(params.items[1].price, 0);
  assert.equal(Math.round(params.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100), 299);
});
