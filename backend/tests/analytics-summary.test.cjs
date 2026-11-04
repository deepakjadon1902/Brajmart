const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { buildOrderAnalytics, collectedOrderPayments } = require('../src/lib/analyticsSummary');
const db = require('../src/lib/db');

const now = () => new Date().toISOString();
const order = (id, status, method, total, subtotal, shipping, packaging, cod) => ({
  id, status, payment_method: method, total, items_subtotal: subtotal,
  shipping_amount: shipping, packaging_amount: packaging, cod_amount: cod,
  items: JSON.stringify([{ price: 100, quantity: 1 }]), coupon_discount: 0, created_at: '2020-01-01T08:00:00Z',
});
const orders = () => [
  order(1, 'confirmed', 'Razorpay', '100.30', '80.10', '10.10', '10.10', 0),
  order(2, 'processing', 'COD', 250, 200, 20, 10, 20),
  order(3, 'shipped', 'COD', 500, 400, 40, 20, 40),
  order(4, 'out_for_delivery', 'COD', 159, null, null, null, null),
  order(5, 'delivered', 'cash on delivery', 300, 200, 50, 10, 40),
  order(6, 'cancelled', 'Razorpay', 900, 800, 50, 50, 0),
  order(7, 'rto', 'COD', 400, 300, 50, 10, 40),
  order(8, 'cancelled', 'COD', 550, 450, 50, 10, 40),
  order(9, 'delivered', 'UPI', '10.35', '10.05', 0, '.30', 0),
];
const payment = (orderId, amount, origin = 'payment', status = 'paid', recordId = orderId, date = now()) => ({
  origin, record_id: recordId, order_id: orderId, amount, status, created_at: date, updated_at: date,
});
const payments = () => [
  payment(1, '100.30'), payment(1, '100.30', 'status'),
  payment(2, 250, 'payment', 'pending'),
  payment(5, 300), payment(5, 300, 'status'),
  payment(6, 900, 'payment', 'paid', 6, '2020-01-01T08:00:00Z'),
  payment(6, 900, 'payment', 'refunded', 7), payment(6, 900, 'status'),
  payment(9, '10.35', 'status'), payment(9, '10.35', 'payment', 'failed'),
];

test('all-time status counts include every order and zero counts independently of dates', () => {
  const rows = orders();
  const result = buildOrderAnalytics(rows, collectedOrderPayments(rows, payments()));
  assert.equal(result.totalOrders, 9);
  assert.deepEqual(result.statuses, { confirmed: 1, processing: 1, shipped: 1, out_for_delivery: 1, delivered: 2, rto: 1, cancelled: 2 });
  assert.equal(Object.values(result.statuses).reduce((sum, count) => sum + count, 0), result.totalOrders);
  const empty = buildOrderAnalytics([], collectedOrderPayments([], []));
  assert.deepEqual(Object.values(empty.statuses), Array(7).fill(0));
  assert.equal(empty.finances.collectedRevenue, 0);
});

test('collections deduplicate payment mirrors, exclude unpaid COD and retain refund authority', () => {
  const rows = orders();
  const collections = collectedOrderPayments(rows, payments());
  assert.deepEqual(collections.entries.map((entry) => [entry.orderId, entry.amount, entry.source]), [
    ['1', 100.30, 'online'], ['5', 300, 'cod'], ['9', 10.35, 'online'],
  ]);
  assert.deepEqual([...collections.refundedOrderIds], ['6']);
  const finances = buildOrderAnalytics(rows, collections).finances;
  assert.equal(finances.collectedRevenue, 410.65);
  assert.equal(finances.onlineCollected, 110.65);
  assert.equal(finances.codCollected, 300);
  assert.equal(finances.collectedOrders, 3);
  assert.equal(finances.codOutstanding, 909);
  assert.equal(finances.codOutstandingOrders, 3);
});

test('saved order amounts use integer paise and recover only provable legacy item subtotals', () => {
  const rows = orders();
  const { finances } = buildOrderAnalytics(rows, collectedOrderPayments(rows, payments()));
  assert.equal(finances.orderValue, 3169.65);
  assert.equal(finances.productValue, 2540.15);
  assert.equal(finances.shippingCharges, 270.1);
  assert.equal(finances.packagingCharges, 120.4);
  assert.equal(finances.codCharges, 180);
  assert.deepEqual(finances.missingBreakdown, { productValue: 0, shippingCharges: 1, packagingCharges: 1, codCharges: 1 });
  assert.equal(finances.serviceCharges, 570.5);
});

test('missing legacy values stay unknown and actual zero charges stay recorded', () => {
  const rows = [
    { ...order(1, 'confirmed', 'Razorpay', 0, null, null, null, null), items: '{bad json' },
    order(2, 'new_status', 'COD', 0, 0, 0, 0, 0),
  ];
  const result = buildOrderAnalytics(rows, collectedOrderPayments(rows, []));
  assert.equal(result.statuses.new_status, 1);
  assert.deepEqual(result.finances.missingBreakdown, { productValue: 1, shippingCharges: 1, packagingCharges: 1, codCharges: 0 });
  assert.equal(result.finances.codOutstanding, 0);
});

test('latest final payment wins and orphaned, invalid and zero payments never become revenue', () => {
  const rows = [order(1, 'delivered', 'COD', 100, 100, 0, 0, 0)];
  const receipts = [
    payment(1, 50, 'payment', 'paid', 1, '2020-01-01T08:00:00Z'),
    payment(1, 100, 'payment', 'paid', 2), payment(999, 999),
  ];
  const selected = collectedOrderPayments(rows, receipts).entries;
  assert.equal(selected.length, 1);
  assert.equal(selected[0].amount, 100);
  for (const amount of [null, '', -100, NaN, 0]) {
    assert.equal(collectedOrderPayments(rows, [payment(1, amount)]).entries.length, 0);
  }
  assert.equal(collectedOrderPayments(rows, [payment(1, 100, 'payment', 'paid', 1, 'bad-date')]).entries.length, 0);
});

let state;
db.isDbConnected = () => state.connected;
db.dbQuery = async (sql) => {
  state.queries.push(sql);
  if (sql.includes("SELECT 'payment' AS origin")) return state.payments;
  if (sql.includes('FROM orders o')) return state.orders;
  if (sql.includes('FROM products')) return [];
  throw new Error('Unexpected analytics query');
};
const router = require('../src/routes/analytics').default;
const { getJwtSecret } = require('../src/middleware/auth');
const request = async ({ period = 'daily', role = 'admin', authenticated = true } = {}) => {
  const response = { statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const token = authenticated ? jwt.sign({ id: 'analytics-test-admin', role }, getJwtSecret()) : '';
  const req = { query: { period }, header: () => token ? `Bearer ${token}` : undefined };
  for (const layer of router.stack.find((entry) => entry.route?.path === '/').route.stack) {
    let next = false;
    await layer.handle(req, response, () => { next = true; });
    if (!next) break;
  }
  return response;
};
beforeEach(() => { state = { connected: true, orders: orders(), payments: payments(), queries: [] }; });

test('analytics API returns fresh all-time totals independently of selected reporting period', async () => {
  const daily = await request();
  const monthly = await request({ period: 'monthly' });
  assert.equal(daily.statusCode, 200);
  assert.deepEqual(daily.body.allTime, monthly.body.allTime);
  assert.equal(daily.body.allTime.totalOrders, 9);
  assert.equal(daily.body.allTime.finances.collectedRevenue, 410.65);
  assert.equal(daily.body.totals.paidSalesCount, 3);
  assert.ok(Math.abs(daily.body.totals.totalRevenue - 410.65) < 0.0001);
  assert.equal(daily.headers['Cache-Control'], 'no-store, max-age=0');
  const orderSql = state.queries.find((sql) => sql.includes('FROM orders o'));
  assert.match(orderSql, /FROM payments vp/); // same merchant visibility as Orders
  state.orders.push(order(10, 'confirmed', 'COD', 123, 100, 10, 3, 10));
  const refreshed = await request();
  assert.equal(refreshed.body.allTime.totalOrders, 10);
  assert.equal(refreshed.body.allTime.statuses.confirmed, 2);
  assert.equal(refreshed.body.allTime.finances.codOutstanding, 1032);
});

test('analytics API enforces admin access and reports database failure without fake totals', async () => {
  assert.equal((await request({ authenticated: false })).statusCode, 401);
  assert.equal((await request({ role: 'customer' })).statusCode, 403);
  assert.equal(state.queries.length, 0);
  state.connected = false;
  const failed = await request();
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.allTime, undefined);
});

test('every period filters statuses and charges by order date, collections by payment date, up to now in India', async (context) => {
  const fixedNow = new Date('2026-11-04T07:00:00.000Z');
  context.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  const dates = ['2026-11-03T18:30:00Z', '2026-11-03T08:00:00Z', '2026-11-01T08:00:00Z', '2026-10-20T08:00:00Z', '2026-02-15T08:00:00Z', '2025-12-15T08:00:00Z', '2026-11-05T07:00:00Z'];
  const statuses = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'delivered', 'confirmed'];
  state.orders = dates.map((date, index) => {
    const id = index + 1;
    const cod = [2, 3, 5, 6].includes(id) ? id * 10 : 0;
    return { ...order(id, statuses[index], cod ? 'COD' : 'Razorpay', id * 100, id * 100 - id * 10 - id * 5 - cod, id * 10, id * 5, cod), created_at: date };
  });
  state.payments = [
    payment(1, 100, 'payment', 'paid', 1, '2026-11-04T06:59:00Z'),
    payment(4, 400, 'payment', 'paid', 4, '2026-10-20T08:00:00Z'),
    payment(4, 999, 'payment', 'paid', 40, '2026-11-05T07:00:00Z'), // future record must not shadow the actual receipt
    payment(5, 500, 'payment', 'paid', 5, '2026-02-16T08:00:00Z'),
    payment(6, 600, 'payment', 'paid', 6, '2026-11-04T06:58:00Z'), // earlier order collected today
    payment(7, 700, 'payment', 'paid', 7, '2026-11-05T07:00:00Z'),
  ];
  const cases = [
    ['daily', '2026-11-03T18:30:00.000Z', 1, 100, 700, 10, 5, 0, 0],
    ['weekly', '2026-11-01T18:30:00.000Z', 2, 300, 700, 30, 15, 20, 200],
    ['monthly', '2026-10-31T18:30:00.000Z', 3, 600, 700, 60, 30, 50, 500],
    ['quarterly', '2026-09-30T18:30:00.000Z', 4, 1000, 1100, 100, 50, 50, 500],
    ['yearly', '2025-12-31T18:30:00.000Z', 5, 1500, 1600, 150, 75, 100, 500],
  ];
  for (const [period, start, count, value, revenue, shipping, packaging, cod, outstanding] of cases) {
    const response = await request({ period });
    assert.equal(response.statusCode, 200);
    const report = response.body;
    const summary = report.periodSummary;
    assert.equal(summary.totalOrders, count, period);
    assert.equal(Object.values(summary.statuses).reduce((sum, number) => sum + number, 0), count);
    assert.equal(summary.statuses.processing, count >= 2 ? 1 : 0);
    assert.equal(summary.statuses.shipped, count >= 3 ? 1 : 0);
    assert.equal(summary.finances.orderValue, value);
    assert.equal(summary.finances.collectedRevenue, revenue);
    assert.equal(summary.finances.shippingCharges, shipping);
    assert.equal(summary.finances.packagingCharges, packaging);
    assert.equal(summary.finances.codCharges, cod);
    assert.equal(summary.finances.codOutstanding, outstanding);
    assert.equal(report.range.start, start);
    assert.equal(report.range.end, fixedNow.toISOString());
    assert.equal(report.generatedAt, fixedNow.toISOString());
    assert.equal(report.totals.periodRevenue, revenue);
    assert.equal(report.totals.periodOrders, count);
    assert.equal(report.buckets.at(-1).revenue, revenue);
    assert.equal(report.allTime.totalOrders, 6);
    assert.equal(report.allTime.finances.collectedRevenue, 1600);
  }
  state.orders[0].status = 'shipped';
  state.orders[0].shipping_amount = 15;
  context.mock.timers.tick(15_000);
  const fresh = await request();
  assert.equal(fresh.body.periodSummary.statuses.confirmed, 0);
  assert.equal(fresh.body.periodSummary.statuses.shipped, 1);
  assert.equal(fresh.body.periodSummary.finances.shippingCharges, 15);
});

test('automatic refresh moves the daily window at India midnight', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T18:29:59Z') });
  state.orders = [
    { ...order(1, 'confirmed', 'COD', 100, 100, 0, 0, 0), created_at: '2026-11-04T08:00:00Z' },
    { ...order(2, 'shipped', 'COD', 200, 200, 0, 0, 0), created_at: '2026-11-04T18:30:00Z' },
  ];
  state.payments = [];
  const before = (await request()).body;
  assert.equal(before.periodSummary.statuses.confirmed, 1);
  assert.equal(before.periodSummary.statuses.shipped, 0);
  context.mock.timers.tick(2_000);
  const after = (await request()).body;
  assert.equal(after.range.start, '2026-11-04T18:30:00.000Z');
  assert.equal(after.periodSummary.statuses.confirmed, 0);
  assert.equal(after.periodSummary.statuses.shipped, 1);
  assert.equal(after.periodSummary.finances.orderValue, 200);
});
