const assert = require('node:assert/strict');
const { test, beforeEach, after } = require('node:test');
const crypto = require('node:crypto');
const path = require('node:path');

// Exercise the real routes with isolated database and gateway doubles.
// No production database, Razorpay account or Meta dataset is contacted.
let state;
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const db = require('../src/lib/db');
db.isDbConnected = () => state.connected;
db.dbQuery = async (sql) => {
  state.queries.push(sql);
  if (sql.includes('FROM orders')) return state.order ? [state.order] : [];
  if (sql.includes('FROM payment_status ps')) return state.paidRows;
  if (sql.includes('FROM payment_status')) return state.statusRow ? [state.statusRow] : [];
  if (sql.includes('FROM payments')) return [];
  if (sql.includes('FROM meta_order_contexts')) return state.context ? [state.context] : [];
  if (sql.includes('FROM meta_conversion_events')) return state.eventStatus ? [{ status: state.eventStatus }] : [];
  throw new Error(`Unexpected test query: ${sql}`);
};
db.dbExecute = async (sql, params) => {
  state.writes.push({ sql, params });
  if (sql.includes('INSERT IGNORE INTO meta_conversion_events')) {
    if (state.eventStatus) return { affectedRows: 0 };
    state.eventStatus = 'pending';
    return { affectedRows: 1 };
  }
  if (sql.includes('attempts = attempts + 1')) {
    if (sql.includes("AND status = 'failed'") && state.eventStatus !== 'failed') return { affectedRows: 0 };
    state.eventStatus = 'pending';
    return { affectedRows: 1 };
  }
  if (sql.includes('UPDATE meta_conversion_events SET status = ?')) state.eventStatus = params[0];
  return { affectedRows: 1, insertId: 1 };
};

function stub(relative, exports) {
  const id = require.resolve(path.join('../src', relative));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const noop = async () => {};
stub('lib/email', Object.fromEntries(['sendAdminPaymentNotice', 'sendOrderConfirmation', 'sendPaymentFailed', 'sendPaymentReceipt'].map((name) => [name, noop])));
stub('lib/eta', { getEtaConfig: async () => ({ min: 1, max: 3 }), getEtaText: () => '1-3 days', getEstimatedDeliveryDate: () => new Date() });
stub('lib/orderPricing', { markCouponUsed: noop });
stub('lib/inventory', { convertReservationToSale: noop, releaseInventoryForOrder: noop, reserveInventoryForOrder: noop });
db.withDbTransaction = async (fn) => fn({});

const meta = require('../src/routes/metaConversions');
const payments = require('../src/routes/payments');
const razorpay = require('../src/routes/razorpay').default;

beforeEach(() => {
  const now = new Date();
  state = {
    connected: true,
    order: { id: 42, total: 199.99, payment_method: 'Razorpay', items: JSON.stringify([{ id: '101', price: 199.99, quantity: 1 }]), created_at: now },
    statusRow: { token: 'order_Real42', order_id: 42, amount: 199.99, method: 'Razorpay', status: 'pending' },
    paidRows: [{ token: 'order_Real42', payment_id: 'pay_Real42', transaction_id: 'pay_Real42', amount: 199.99, payment_amount: 199.99, status_updated_at: now, payment_updated_at: now }],
    payment: { id: 'pay_Real42', order_id: 'order_Real42', amount: 19999, currency: 'INR', status: 'captured', captured: true, amount_refunded: 0, created_at: Math.floor(now.getTime() / 1000) },
    orderPayments: [], queries: [], writes: [], metaCalls: [], gatewayCalls: [], eventStatus: null,
  };
  process.env.META_CONVERSIONS_API_TOKEN = 'isolated-test-token';
  process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_live_IsolatedTest';
  process.env.RAZORPAY_PLATFORM_KEY_SECRET = 'isolated-test-secret';
  process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET = 'isolated-webhook-secret';
  delete process.env.META_TEST_EVENT_CODE;
  delete process.env.GA4_API_SECRET;
  global.fetch = async (url, options) => {
    const target = new URL(url);
    if (target.hostname === 'graph.facebook.com') {
      state.metaCalls.push(JSON.parse(options.body));
      if (state.metaError) throw new Error('Simulated Meta network failure');
      state.metaTargets ||= [];
      state.metaTargets.push({ url: target, options });
      return { ok: !state.metaHttpError, status: state.metaHttpError ? 500 : 200, json: async () => {
        if (state.metaInvalidJson) throw new SyntaxError('Invalid Meta response');
        return state.metaResponse || { events_received: 1 };
      }, text: async () => 'Invalid Meta response' };
    }
    assert.equal(target.hostname, 'api.razorpay.com');
    state.gatewayCalls.push(target.pathname + target.search);
    if (state.gatewayError) throw new Error('Simulated Razorpay outage');
    const data = target.pathname.endsWith('/payments') || target.search ? { items: state.orderPayments } : target.pathname.includes('/orders/') ? (state.gatewayOrder || {}) : state.payment;
    return { ok: !state.gatewayHttpError, json: async () => data };
  };
});

after(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

async function route(router, routePath, body, extra = {}, method = 'post') {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Route exists: ${routePath}`);
  const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await layer.route.stack.at(-1).handle({ body, headers: {}, socket: {}, ...extra }, response);
  return response;
}
const sendPurchase = () => meta.sendVerifiedMetaPurchaseForOrder(42, 'pay_Real42', 'order_Real42');
async function assertBlocked() {
  const result = await sendPurchase();
  assert.equal(result.ok, false);
  assert.equal(state.metaCalls.length, 0);
}

test('public CAPI endpoint rejects a forged Purchase', async () => {
  const response = await route(meta.default, '/', { eventName: 'Purchase', eventId: 'brajmart.Purchase.order.42', customData: { order_id: 42, value: 199.99 } });
  assert.equal(response.statusCode, 403);
  assert.equal(state.metaCalls.length, 0);
  assert.equal(state.writes.length, 0);
});

test('one valid captured payment sends server-owned value, contents and stable event ID', async () => {
  const result = await sendPurchase();
  assert.equal(result.ok, true);
  assert.equal(state.metaCalls.length, 1);
  const event = state.metaCalls[0].data[0];
  assert.equal(event.event_id, 'brajmart.Purchase.order.42');
  assert.equal(event.event_name, 'Purchase');
  assert.equal(event.custom_data.value, 199.99);
  assert.equal(event.custom_data.currency, 'INR');
  assert.deepEqual(event.custom_data.contents, [{ id: '101', quantity: 1, item_price: 199.99 }]);
  assert.equal(event.event_time, state.payment.created_at);
  assert.ok(state.gatewayCalls.includes('/v1/payments/pay_Real42'));
});

for (const status of ['created', 'authorized', 'failed', 'refunded']) {
  test(`database paid flag cannot turn a ${status} gateway payment into a Meta Purchase`, async () => {
    state.payment.status = status;
    await assertBlocked();
  });
}
for (const [label, change] of [
  ['wrong gateway order', { order_id: 'order_Other' }],
  ['wrong payment ID', { id: 'pay_Other' }],
  ['one paise underpayment', { amount: 19998 }],
  ['overpayment', { amount: 20000 }],
  ['wrong currency', { currency: 'USD' }],
  ['partial refund', { amount_refunded: 1 }],
]) {
  test(`blocks ${label}`, async () => { Object.assign(state.payment, change); await assertBlocked(); });
}
test('blocks captured test-mode payments from the production Meta dataset', async () => {
  process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_test_IsolatedTest';
  await assertBlocked();
});
test('fails closed during a Razorpay network outage', async () => { state.gatewayError = true; await assertBlocked(); });
test('fails closed on a Razorpay HTTP error', async () => { state.gatewayHttpError = true; await assertBlocked(); });
test('database outage produces no purchase', async () => { state.connected = false; await assertBlocked(); });
test('missing order produces no purchase', async () => { state.order = null; await assertBlocked(); });
test('pending or unverified payment produces no purchase', async () => { state.paidRows = []; await assertBlocked(); });
for (const method of ['COD', 'Manual QR', 'UPI']) {
  test(`${method} cannot generate a Meta Purchase`, async () => { state.order.payment_method = method; await assertBlocked(); });
}
test('manual payment identifiers are blocked', async () => {
  const result = await meta.sendVerifiedMetaPurchaseForOrder(42, 'manual_qr_42');
  assert.equal(result.ok, false);
  assert.equal(state.metaCalls.length, 0);
});
test('gateway payment older than seven days cannot be refreshed by database updates', async () => {
  state.payment.created_at -= 8 * 86400;
  await assertBlocked();
});
test('simultaneous first sends produce one outgoing Purchase', async () => {
  await Promise.all([sendPurchase(), sendPurchase(), sendPurchase()]);
  assert.equal(state.metaCalls.length, 1);
});
test('simultaneous retries of a failed event produce one outgoing Purchase', async () => {
  state.eventStatus = 'failed';
  await Promise.all([sendPurchase(), sendPurchase(), sendPurchase()]);
  assert.equal(state.metaCalls.length, 1);
});
test('Meta network failure releases the event for retry with the same event ID', async () => {
  state.metaError = true;
  await sendPurchase().catch(() => {});
  assert.equal(state.eventStatus, 'failed');
  state.metaError = false;
  await sendPurchase();
  assert.equal(state.metaCalls.length, 2);
  assert.equal(state.metaCalls[0].data[0].event_id, state.metaCalls[1].data[0].event_id);
});
test('reconciliation never assigns an unrelated payment using amount alone', async () => {
  state.orderPayments = [{ ...state.payment, order_id: null }];
  await payments.reconcileRazorpayToken('order_Real42');
  assert.equal(state.writes.length, 0);
  assert.equal(state.metaCalls.length, 0);
});
test('a gateway order marked paid without a captured payment is insufficient', async () => {
  state.gatewayOrder = { status: 'paid', amount_paid: 19999, amount: 19999 };
  state.orderPayments = [{ ...state.payment, status: 'authorized' }];
  await payments.reconcileRazorpayToken('order_Real42');
  assert.equal(state.writes.length, 0);
});
test('forged checkout signature does not query Razorpay or mutate an order', async () => {
  const response = await route(razorpay, '/verify', { razorpay_order_id: 'order_Real42', razorpay_payment_id: 'pay_Real42', razorpay_signature: '0'.repeat(64) });
  assert.equal(response.statusCode, 400);
  assert.equal(state.gatewayCalls.length, 0);
  assert.equal(state.writes.length, 0);
});
test('forged webhook signature cannot mark an order paid', async () => {
  const body = { event: 'payment.captured', payload: { payment: { entity: state.payment } } };
  const response = await route(razorpay, '/webhook', body, { rawBody: JSON.stringify(body), headers: { 'x-razorpay-signature': '0'.repeat(64) } });
  assert.equal(response.statusCode, 400);
  assert.equal(state.writes.length, 0);
});
test('even a signed webhook must verify currency and amount with Razorpay before paid writes', async () => {
  const body = { event: 'payment.captured', payload: { payment: { entity: { ...state.payment } } } };
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET).update(rawBody).digest('hex');
  state.payment.currency = 'USD';
  const response = await route(razorpay, '/webhook', body, { rawBody, headers: { 'x-razorpay-signature': signature } });
  assert.equal(response.statusCode, 500);
  assert.equal(state.writes.length, 0);
  assert.equal(state.metaCalls.length, 0);
});

function checkoutBody() {
  return {
    razorpay_order_id: 'order_Real42', razorpay_payment_id: 'pay_Real42',
    razorpay_signature: crypto.createHmac('sha256', process.env.RAZORPAY_PLATFORM_KEY_SECRET).update('order_Real42|pay_Real42').digest('hex'),
  };
}
function webhookRequest(body) {
  const rawBody = JSON.stringify(body);
  return { rawBody, headers: { 'x-razorpay-signature': crypto.createHmac('sha256', process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET).update(rawBody).digest('hex') } };
}
test('valid signed checkout confirms the website order and sends exactly one verified Purchase', async () => {
  const response = await route(razorpay, '/verify', checkoutBody());
  await new Promise(setImmediate);
  assert.equal(response.statusCode, 200);
  assert.equal(response.data.status, 'paid');
  assert.ok(state.writes.some(({ sql, params }) => sql.includes('UPDATE orders SET status') && params[0] === 'confirmed'));
  assert.equal(state.metaCalls.length, 1);
});
for (const event of ['payment.captured', 'order.paid']) {
  test(`valid signed ${event} webhook confirms the website order and sends one Purchase`, async () => {
    const body = { event, payload: { payment: { entity: state.payment } } };
    const response = await route(razorpay, '/webhook', body, webhookRequest(body));
    await new Promise(setImmediate);
    assert.equal(response.statusCode, 200);
    assert.ok(state.writes.some(({ sql, params }) => sql.includes('UPDATE orders SET status') && params[0] === 'confirmed'));
    assert.equal(state.metaCalls.length, 1);
  });
}
for (const [label, change] of [
  ['authorized', { status: 'authorized', captured: false }],
  ['wrong amount', { amount: 19998 }],
  ['wrong currency', { currency: 'USD' }],
  ['wrong order', { order_id: 'order_Other' }],
]) {
  test(`signed checkout with ${label} payment cannot mark the website order paid`, async () => {
    Object.assign(state.payment, change);
    const response = await route(razorpay, '/verify', checkoutBody());
    assert.equal(response.statusCode, 500);
    assert.equal(state.writes.length, 0);
    assert.equal(state.metaCalls.length, 0);
  });
  test(`reconciliation rejects ${label} payment before any website paid writes`, async () => {
    state.orderPayments = [{ ...state.payment, ...change }];
    await payments.reconcileRazorpayToken('order_Real42');
    assert.equal(state.writes.length, 0);
    assert.equal(state.metaCalls.length, 0);
  });
}
test('valid reconciliation confirms the website order and sends one Purchase', async () => {
  state.orderPayments = [state.payment];
  await payments.reconcileRazorpayToken('order_Real42');
  await new Promise(setImmediate);
  assert.ok(state.writes.some(({ sql, params }) => sql.includes('UPDATE orders SET status') && params[0] === 'confirmed'));
  assert.equal(state.metaCalls.length, 1);
});
test('checkout signature with appended non-hex characters is rejected', async () => {
  const body = checkoutBody();
  body.razorpay_signature += 'zz';
  const response = await route(razorpay, '/verify', body);
  assert.equal(response.statusCode, 400);
  assert.equal(state.writes.length, 0);
});
test('a signed webhook without the exact raw request body is rejected', async () => {
  const body = { event: 'payment.captured', payload: { payment: { entity: state.payment } } };
  const response = await route(razorpay, '/webhook', body, { headers: webhookRequest(body).headers });
  assert.equal(response.statusCode, 400);
  assert.equal(state.writes.length, 0);
});
test('a webhook cannot match an order from amount and notes without a gateway order ID', async () => {
  const body = { event: 'payment.captured', payload: { payment: { entity: { ...state.payment, order_id: null, notes: { brajmart_order_id: '42' } } } } };
  const response = await route(razorpay, '/webhook', body, webhookRequest(body));
  assert.equal(response.data.ignored, true);
  assert.equal(state.writes.length, 0);
  assert.equal(state.metaCalls.length, 0);
});
test('stored settlement amount differing by one paise is rejected', async () => { state.paidRows[0].amount = 199.98; await assertBlocked(); });
test('stored payment amount differing by one paise is rejected', async () => { state.paidRows[0].payment_amount = 199.98; await assertBlocked(); });
test('different payment and settlement identifiers cannot be combined', async () => { state.paidRows[0].transaction_id = 'pay_Other'; await assertBlocked(); });
test('zero-value orders cannot generate purchases', async () => { state.order.total = 0; await assertBlocked(); });
test('empty order contents cannot generate purchases', async () => { state.order.items = '[]'; await assertBlocked(); });
test('Meta HTTP error permits retry using the stable ID', async () => {
  state.metaHttpError = true;
  await sendPurchase();
  assert.equal(state.eventStatus, 'failed');
  state.metaHttpError = false;
  await sendPurchase();
  assert.equal(state.eventStatus, 'sent');
  assert.equal(state.metaCalls.length, 2);
  assert.equal(state.metaCalls[0].data[0].event_id, state.metaCalls[1].data[0].event_id);
});
test('admin manual confirmation cannot convert an unpaid Razorpay checkout to paid', async () => {
  const response = await route(payments.default, '/admin/confirm-pending/:orderId', { transactionId: 'pay_Fake' }, { params: { orderId: '42' } });
  assert.equal(response.statusCode, 400);
  assert.equal(state.writes.length, 0);
  assert.equal(state.metaCalls.length, 0);
});
test('public payment recording cannot create paid evidence', async () => {
  const response = await route(payments.default, '/', { status: 'paid', method: 'Razorpay', orderId: 42, transactionId: 'pay_Fake' });
  assert.equal(response.statusCode, 403);
  assert.equal(state.writes.length, 0);
});
test('admin status editing cannot set a payment to paid', async () => {
  const response = await route(payments.default, '/:id', { status: 'paid' }, { params: { id: '42' } }, 'put');
  assert.equal(response.statusCode, 400);
  assert.equal(state.writes.length, 0);
});

for (const response of [{ events_received: 0 }, { error: { message: 'Invalid event' } }, {}]) {
  test(`Meta HTTP 200 without event acceptance is not recorded as sent: ${JSON.stringify(response)}`, async () => {
    state.metaResponse = response;
    const result = await sendPurchase();
    assert.equal(result.ok, false);
    assert.equal(state.eventStatus, 'failed');
  });
}
test('malformed Meta success response is not recorded as sent', async () => {
  state.metaInvalidJson = true;
  const result = await sendPurchase();
  assert.equal(result.ok, false);
  assert.equal(state.eventStatus, 'failed');
});
test('customer identifiers are normalized and hashed while browser IDs remain unchanged', async () => {
  state.order.customer_email = '  TEST@Example.Com  ';
  state.order.billing_address = JSON.stringify({ mobile: '98765 43210' });
  state.context = { client_ip: '203.0.113.10', client_user_agent: 'Isolated QA Browser', fbp: 'fb.1.1700000000000.123456789', fbc: 'fb.1.1700000000000.test-click', event_source_url: 'https://www.brajmart.com/checkout', external_id: 'Customer-42' };
  await sendPurchase();
  const event = state.metaCalls[0].data[0];
  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
  assert.deepEqual(event.user_data.em, [hash('test@example.com')]);
  assert.deepEqual(event.user_data.ph, [hash('919876543210')]);
  assert.equal(event.user_data.fbp, state.context.fbp);
  assert.equal(event.user_data.fbc, state.context.fbc);
  assert.equal(event.user_data.client_ip_address, '203.0.113.10');
  assert.equal(event.user_data.client_user_agent, 'Isolated QA Browser');
  assert.equal(event.event_source_url, 'https://www.brajmart.com/checkout');
  assert.equal(event.action_source, 'website');
  assert.ok(!JSON.stringify(event).includes('TEST@Example.Com'));
  assert.ok(!JSON.stringify(event).includes('98765 43210'));
});
test('Meta endpoint uses the configured dataset and API version', async () => {
  process.env.META_PIXEL_ID = '1234567890123456';
  process.env.META_CONVERSIONS_API_VERSION = 'v21.0';
  await sendPurchase();
  assert.equal(state.metaTargets[0].url.pathname, '/v21.0/1234567890123456/events');
  assert.equal(state.metaTargets[0].options.method, 'POST');
  assert.equal(state.metaTargets[0].options.headers['Content-Type'], 'application/json');
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CONVERSIONS_API_VERSION;
});
test('test event code is included only when explicitly configured', async () => {
  process.env.META_TEST_EVENT_CODE = 'ISOLATED_TEST_ONLY';
  await sendPurchase();
  assert.equal(state.metaCalls[0].test_event_code, 'ISOLATED_TEST_ONLY');
});
test('a production payload has no test event code', async () => {
  await sendPurchase();
  assert.equal(Object.hasOwn(state.metaCalls[0], 'test_event_code'), false);
});
test('a sent Purchase is never resent on refresh or repeated callbacks', async () => {
  state.eventStatus = 'sent';
  const result = await sendPurchase();
  assert.equal(result.reason, 'duplicate_purchase_event');
  assert.equal(state.metaCalls.length, 0);
});
test('a pending Purchase is never claimed by another sender', async () => {
  state.eventStatus = 'pending';
  await sendPurchase();
  assert.equal(state.metaCalls.length, 0);
});

test('a repeated signed paid callback retries a failed Meta delivery without recreating the order', async () => {
  state.statusRow.status = 'paid'; state.statusRow.payment_id = 'pay_Real42';
  state.metaError = true;
  await route(razorpay, '/verify', checkoutBody());
  await new Promise(setImmediate);
  assert.equal(state.eventStatus, 'failed');
  state.metaError = false;
  await route(razorpay, '/verify', checkoutBody());
  await new Promise(setImmediate);
  assert.equal(state.eventStatus, 'sent');
  assert.equal(state.metaCalls.length, 2);
  assert.equal(state.writes.filter(({ sql }) => sql.includes('UPDATE orders SET status')).length, 0);
});

test('a paid database flag cannot display a verified receipt for an uncaptured payment', async () => {
  state.statusRow.status = 'paid'; state.statusRow.payment_id = 'pay_Real42';
  state.payment.status = 'authorized'; state.payment.captured = false;
  const response = await route(payments.default, '/status/:token', {}, { params: { token: 'order_Real42' } }, 'get');
  assert.equal(response.data.status, 'pending');
  assert.equal(response.data.verificationStatus, 'unverified');
  assert.match(response.headers['Cache-Control'], /no-store/);
  assert.equal(state.metaCalls.length, 0);
});

test('a real captured receipt stays paid and cannot be served from a stale browser cache', async () => {
  state.statusRow.status = 'paid'; state.statusRow.payment_id = 'pay_Real42';
  const response = await route(payments.default, '/status/:token', {}, { params: { token: 'order_Real42' } }, 'get');
  await new Promise(setImmediate);
  assert.equal(response.data.status, 'paid');
  assert.equal(response.data.orderId, 42);
  assert.match(response.headers['Cache-Control'], /no-store/);
});

test('production payment confirmation rejects captured test-mode payments before paid writes', async () => {
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production'; process.env.RAZORPAY_PLATFORM_KEY_ID = 'rzp_test_Isolated';
  try {
    const response = await route(razorpay, '/verify', checkoutBody());
    assert.equal(response.statusCode, 500);
    assert.equal(state.writes.length, 0);
  } finally { if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode; }
});

test('BLOB-encoded saved items still produce a correct verified Purchase', async () => {
  state.order.items = Buffer.from(state.order.items);
  assert.equal((await sendPurchase()).ok, true);
  assert.equal(state.metaCalls[0].data[0].custom_data.contents[0].id, '101');
});
test('no Meta credentials means no outgoing event and no sent status', async () => {
  delete process.env.META_CONVERSIONS_API_TOKEN;
  const result = await sendPurchase();
  assert.equal(result.ok, false);
  assert.equal(state.metaCalls.length, 0);
  assert.notEqual(state.eventStatus, 'sent');
});
