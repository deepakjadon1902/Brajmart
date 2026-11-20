const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { afterEach, beforeEach, test } = require('node:test');
const gateway = require('../src/lib/cashfree');
const db = require('../src/lib/db');

const token = 'cf_b4bc5b0d-287c-4ab9-9e78-ae0c4e91f801';
const secret = 'cashfree-test-fixture';
const env = { APP_ENV: 'staging', CASHFREE_ENV: 'sandbox', CASHFREE_APP_ID: 'fixture-app', CASHFREE_SECRET_KEY: secret };
const restore = { ...process.env };
const originalFetch = global.fetch;
const order = { order_id: token, order_amount: 199.99, order_currency: 'INR', order_status: 'PAID', payment_session_id: 'session_fixture' };
const payment = { order_id: token, cf_payment_id: '1876534', payment_amount: 199.99, payment_currency: 'INR', payment_status: 'SUCCESS', is_captured: true };
const webhookBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: token } } });
const timestamp = '1723333333333';
const sign = (body) => crypto.createHmac('sha256', secret).update(timestamp + body).digest('base64');

beforeEach(() => {
  Object.assign(process.env, env);
  delete process.env.BACKEND_URL;
  delete process.env.PUBLIC_BASE_URL;
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const variable of Object.keys(env)) {
    if (restore[variable] === undefined) delete process.env[variable];
    else process.env[variable] = restore[variable];
  }
  if (restore.BACKEND_URL !== undefined) process.env.BACKEND_URL = restore.BACKEND_URL;
  if (restore.PUBLIC_BASE_URL !== undefined) process.env.PUBLIC_BASE_URL = restore.PUBLIC_BASE_URL;
});

test('Cashfree requires matching deployment mode and a public HTTPS production webhook', () => {
  assert.equal(gateway.resolveCashfreeConfig(env).apiUrl, 'https://sandbox.cashfree.com/pg');
  assert.throws(() => gateway.resolveCashfreeConfig({ ...env, APP_ENV: 'production' }), gateway.CashfreeConfigurationError);
  assert.throws(() => gateway.resolveCashfreeConfig({ ...env, APP_ENV: 'production', CASHFREE_ENV: 'production' }), gateway.CashfreeConfigurationError);
  assert.equal(gateway.resolveCashfreeConfig({
    ...env, APP_ENV: 'production', CASHFREE_ENV: 'production', BACKEND_URL: 'https://api.example.invalid',
  }).notifyUrl, 'https://api.example.invalid/api/cashfree/webhook');
});

test('Cashfree sends amount, merchant order ID and a stable idempotency key from the server', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://sandbox.cashfree.com/pg/orders');
    assert.equal(options.headers['x-idempotency-key'], token.slice(3));
    assert.equal(options.headers['x-client-secret'], secret);
    const data = JSON.parse(options.body);
    assert.equal(data.order_id, token);
    assert.equal(data.order_amount, 199.99);
    assert.equal(data.order_currency, 'INR');
    assert.ok(data.order_meta.return_url.endsWith('/payment-status/' + token));
    return Response.json({ ...order, order_status: 'ACTIVE' });
  };
  const session = await gateway.createCashfreeSession(gateway.resolveCashfreeConfig(), {
    token, amount: 199.99, expiresAt: Date.now() + 100_000, alreadyPaid: false, created: true,
    customerName: 'Fixture Customer', customerEmail: 'fixture@example.invalid', customerPhone: '9876543210',
  });
  assert.deepEqual(session, { mode: 'sandbox', paymentSessionId: 'session_fixture' });
});

test('Cashfree verifies the exact raw body and rejects malformed signatures', () => {
  assert.equal(gateway.verifyCashfreeSignature(webhookBody, timestamp, sign(webhookBody), secret), true);
  assert.equal(gateway.verifyCashfreeSignature(webhookBody + ' ', timestamp, sign(webhookBody), secret), false);
  assert.equal(gateway.verifyCashfreeSignature(webhookBody, timestamp, 'broken', secret), false);
});

const mockGatewayPayment = (remoteOrder, payments) => {
  global.fetch = async (url) => Response.json(url.endsWith('/payments') ? payments : remoteOrder);
};

test('Cashfree confirms only a captured payment matching the order, currency, and total', async () => {
  mockGatewayPayment(order, [payment]);
  assert.deepEqual(await gateway.checkCashfreePayment(token, 199.99), { status: 'paid', paymentId: '1876534' });
  for (const incorrect of [{ payment_amount: 200 }, { order_id: 'other' }, { payment_currency: 'USD' }, { is_captured: false }]) {
    mockGatewayPayment(order, [{ ...payment, ...incorrect }]);
    assert.equal((await gateway.checkCashfreePayment(token, 199.99)).status, 'pending');
  }
});

test('Cashfree keeps an unsettled attempt pending but expires an inactive unpaid order', async () => {
  const expired = { ...order, order_status: 'EXPIRED' };
  mockGatewayPayment(expired, [{ ...payment, payment_status: 'PENDING' }]);
  assert.equal((await gateway.checkCashfreePayment(token, 199.99)).status, 'pending');
  mockGatewayPayment(expired, [{ ...payment, payment_status: 'FAILED' }]);
  assert.deepEqual(await gateway.checkCashfreePayment(token, 199.99), { status: 'failed' });
  mockGatewayPayment({ ...order, order_status: 'ACTIVE' }, [{ ...payment, payment_status: 'USER_DROPPED' }]);
  assert.equal((await gateway.checkCashfreePayment(token, 199.99)).session.paymentSessionId, 'session_fixture');
});

test('a signed Cashfree success settles and sends notices once across duplicate callbacks', async (t) => {
  const notices = require('../src/lib/paymentNotices');
  const reminders = require('../src/lib/cartFollowups');
  const inventory = require('../src/lib/inventory');
  const router = require('../src/routes/cashfree').default;
  const callback = router.stack.find(({ route }) => route?.path === '/webhook').route.stack[0].handle;
  const attempt = { token, method: 'Cashfree', order_id: 42, amount: 199.99, status: 'pending' };
  const orderRow = { id: 42, payment_method: 'Cashfree', status: 'pending_payment', total: 199.99, items: '[]', status_history: '[]' };
  let notified = 0;
  let converted = 0;
  t.mock.method(notices, 'sendPaymentOutcomeNotices', async () => { notified++; });
  t.mock.method(reminders, 'cancelCartRemindersForOrder', async () => {});
  t.mock.method(inventory, 'convertReservationToSale', async () => { converted++; });
  t.mock.method(db, 'isDbConnected', () => true);
  t.mock.method(db, 'dbQuery', async () => [{ ...attempt }]);
  t.mock.method(db, 'withDbTransaction', async (execute) => execute({
    query: async (sql) => [sql.includes('FROM orders') ? [orderRow] : [attempt]],
    execute: async (sql, values) => {
      if (sql.startsWith('UPDATE payment_status')) [attempt.status, attempt.payment_id] = values;
    },
  }));
  mockGatewayPayment(order, [payment]);
  const header = { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': sign(webhookBody) };
  const req = { rawBody: webhookBody, body: JSON.parse(webhookBody), get: (name) => header[name] };
  const response = { sendStatus: (code) => code };
  assert.equal(await callback(req, response), 200);
  assert.equal(await callback(req, response), 200);
  assert.equal(attempt.payment_id, payment.cf_payment_id);
  assert.equal(converted, 1);
  assert.equal(notified, 1);
});
