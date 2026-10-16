const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { Writable } = require('node:stream');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
const fixture = require('./fixtures/order-invoice.cjs');
const invoice = require('../src/lib/orderInvoice');
const db = require('../src/lib/db');
let state;
db.isDbConnected = () => state.connected;
db.dbQuery = async (sql, params = []) => {
  state.queries.push({ sql, params });
  if (sql.includes('FROM orders')) {
    assert.match(sql, /FROM payments/);
    if (sql.includes('MAX(id)')) return [{ max_id: state.orders.at(-1)?.id, invoice_count: state.orders.length }];
    if (sql.includes('id > ?')) return state.orders.filter((row) => row.id > Number(params[0]) && row.id <= Number(params[1])).slice(0, 100);
    return state.orders.filter((row) => String(row.id) === String(params[0]));
  }
  if (sql.includes('FROM payments')) { assert.match(sql, /status = 'paid'/); return state.payments; }
  if (sql.includes('FROM payment_status')) { assert.match(sql, /status = 'paid'/); return state.paymentStatuses; }
  throw new Error(`Unexpected invoice query: ${sql}`);
};
const router = require('../src/routes/orders').default;
const { getJwtSecret } = require('../src/middleware/auth');
class Response extends Writable {
  constructor() { super(); this.chunks = []; this.headers = {}; this.statusCode = 200; this.headersSent = false; this.on('error', () => {}); }
  _write(chunk, _encoding, done) { this.headersSent = true; this.chunks.push(Buffer.from(chunk)); done(); }
  setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; }
  status(code) { this.statusCode = code; return this; }
  json(body) { this.setHeader('Content-Type', 'application/json'); this.end(JSON.stringify(body)); return this; }
  send(body) { this.end(body); return this; }
}
async function request(path, { role = 'admin', token = true, params = {}, query = {} } = {}) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods.get).route;
  const response = new Response();
  const authorization = token ? `Bearer ${jwt.sign({ id: 'test-admin', role }, getJwtSecret())}` : '';
  const req = { params, query, header: (key) => key.toLowerCase() === 'authorization' ? authorization : undefined };
  for (const layer of route.stack) {
    let next = false;
    await layer.handle(req, response, () => { next = true; });
    if (!next) break;
  }
  if (!response.writableFinished && !response.destroyed) await once(response, 'finish');
  response.body = Buffer.concat(response.chunks);
  return response;
}
beforeEach(() => { state = { connected: true, orders: [{ ...fixture }], payments: [], paymentStatuses: [], queries: [] }; });

test('invoice numbers use the order date in India and prices come from the order snapshot', () => {
  const model = invoice.buildOrderInvoiceModel({ ...fixture, created_at: '2026-10-14T20:00:00Z', items: JSON.stringify(fixture.items) });
  assert.equal(model.invoiceNumber, '1033915102026');
  assert.equal(model.orderDate, 'October 15, 2026');
  assert.equal(model.items[0].sku, 'TMK-21');
  assert.equal(model.total, 15900);
  assert.deepEqual(model.billing, fixture.shipping_address);
});
test('COD fees and discounts reconcile to the stored total using integer paise', () => {
  const model = invoice.buildOrderInvoiceModel({ ...fixture, items: [{ name: 'Mala', price: 0.1, quantity: 3 }], shipping_amount: 49, packaging_amount: 0, cod_amount: 40, coupon_discount: 10, coupon_code: 'SAVE10', total: 79.3 });
  assert.equal(model.totals.reduce((sum, row) => sum + row.amount, 0), 7930);
  assert.equal(model.totals.some((row) => row.label === 'Order adjustment'), false);
  assert.equal(model.totals.find((row) => row.label === 'COD Fee').amount, 4000);
});
test('missing legacy charges are labelled honestly and AWBs are never payment IDs or SKUs', () => {
  const model = invoice.buildOrderInvoiceModel({ ...fixture, tracking_id: 'AWB-123', items: [{ name: 'Mala', quantity: 1, price: 100, productId: '21' }], shipping_amount: null, packaging_amount: null, cod_amount: null });
  assert.equal(model.paymentId, '');
  assert.equal(model.items[0].sku, '');
  assert.deepEqual(model.totals[1], { label: 'Shipping & packaging', amount: 5900 });
});
test('invalid order prices and quantities fail instead of producing an inaccurate invoice', () => {
  for (const item of [{ quantity: 0, price: 100 }, { quantity: 1, price: null }, { quantity: 1, price: 'bad' }]) {
    assert.throws(() => invoice.buildOrderInvoiceModel({ ...fixture, items: [item] }), /Cannot generate invoice|invalid quantity/);
  }
});
test('single invoice endpoint sends an actual PDF attachment using recorded payment evidence', async () => {
  state.paymentStatuses = [{ order_id: fixture.id, payment_id: 'pay_recorded', method: 'UPI' }];
  const response = await request('/:id/invoice', { params: { id: String(fixture.id) }, query: { download: '1' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/pdf');
  assert.match(response.headers['content-disposition'], /attachment; filename="BrajMart-Invoice-10339.pdf"/);
  assert.equal(response.body.subarray(0, 5).toString(), '%PDF-');
  assert.match(response.body.toString('latin1'), /\/Count 1\b/);
  assert.equal(response.headers['cache-control'], 'private, no-store');
});
test('invoice endpoints enforce admin authorization', async () => {
  for (const path of ['/:id/invoice', '/admin/invoices.zip']) {
    assert.equal((await request(path, { token: false })).statusCode, 401);
    assert.equal((await request(path, { role: 'customer' })).statusCode, 403);
  }
  assert.equal(state.queries.length, 0);
});
test('all invoices ZIP spans database batches and ignores table pagination and filters', async () => {
  state.orders = Array.from({ length: 101 }, (_, index) => ({ ...fixture, id: 10000 + index }));
  const originalBuild = invoice.buildOrderInvoicePdf;
  invoice.buildOrderInvoicePdf = async (row) => Buffer.from(`%PDF-1.4\nOrder ${row.id}\n%%EOF`);
  try {
    const response = await request('/admin/invoices.zip', { query: { page: 2, search: 'does-not-match', status: 'shipped' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/zip');
    assert.equal(response.headers['x-invoice-count'], '101');
    assert.equal(response.body.subarray(0, 2).toString(), 'PK');
    const end = response.body.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.equal(response.body.readUInt16LE(end + 10), 101, 'ZIP central directory contains every invoice');
    assert.ok(response.body.includes(Buffer.from('BrajMart-Invoice-10000.pdf')));
    assert.ok(response.body.includes(Buffer.from('BrajMart-Invoice-10100.pdf')));
    const queries = state.queries.filter(({ sql }) => sql.includes('id > ?'));
    assert.deepEqual(queries.map(({ params }) => params[0]), ['0', '10099', '10100']);
  } finally { invoice.buildOrderInvoicePdf = originalBuild; }
});
test('an empty invoice export returns a useful error instead of an empty ZIP', async () => {
  state.orders = [];
  const response = await request('/admin/invoices.zip');
  assert.equal(response.statusCode, 404);
  assert.match(response.body.toString(), /no order invoices/);
});
