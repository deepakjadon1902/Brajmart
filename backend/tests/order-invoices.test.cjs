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
    if (sql.startsWith('SELECT id, customer_name, shipping_address, created_at FROM orders')) return state.orders;
    if (sql.includes('id > ?')) return state.orders.filter((row) => row.id > Number(params[0]) && row.id <= Number(params[1])).slice(0, 100);
    if (!sql.includes('LIMIT 1')) return state.orders;
    return state.orders.filter((row) => String(row.id) === String(params[0]));
  }
  if (sql.includes('FROM payments')) { assert.match(sql, /status = 'paid'/); return state.payments; }
  if (sql.includes('FROM payment_status')) { assert.match(sql, /status = 'paid'/); return state.paymentStatuses; }
  if (sql.includes('FROM products')) return state.products;
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
beforeEach(() => { state = { connected: true, orders: [{ ...fixture }], products: [], payments: [], paymentStatuses: [], queries: [] }; });

test('invoice numbers use the order date in India and prices come from the order snapshot', () => {
  const model = invoice.buildOrderInvoiceModel({ ...fixture, created_at: '2026-10-14T20:00:00Z', items: JSON.stringify(fixture.items) });
  assert.equal(model.invoiceNumber, '1033915102026');
  assert.equal(model.orderDate, 'October 15, 2026');
  assert.equal(model.items[0].sku, 'TMK-21');
  assert.equal(model.total, 15900);
  assert.deepEqual(model.billing, fixture.shipping_address);
});

const taxItem = (overrides = {}) => ({ name: 'Krishna Balaram Devotional Toys - Set of 2', sku: 'TOY-21', hsnCode: '9503', unit: 'SET', quantity: 1, price: 219, gstRate: 5, ...overrides });
const taxOrder = (overrides = {}) => ({ ...fixture, items: [taxItem()], total: 268, shipping_amount: 49, packaging_amount: 0, shipping_address: { ...fixture.shipping_address, state: 'Madhya Pradesh' }, ...overrides });

test('reference invoice extracts 5% IGST from INR 219 and does not add GST to the INR 268 total', () => {
  const model = invoice.buildOrderInvoiceModel(taxOrder());
  assert.deepEqual([model.items[0].price, model.items[0].taxable, model.items[0].igst, model.items[0].netTotal], [21900, 20857, 1043, 21900]);
  assert.equal(model.taxMode, 'inter-state');
  assert.equal(model.items[0].cgst, 0);
  assert.equal(model.total, 26800);
  assert.equal(model.totals.reduce((sum, line) => sum + line.amount, 0), model.total);
  assert.deepEqual(model.taxSummary.map((line) => line.amount), [20857, 1043]);
});

test('same-state orders split the included tax into CGST and SGST and keep odd paise', () => {
  const model = invoice.buildOrderInvoiceModel(taxOrder({ shipping_address: fixture.shipping_address }));
  assert.equal(model.taxMode, 'intra-state');
  assert.deepEqual([model.items[0].igst, model.items[0].cgst, model.items[0].sgst], [0, 521, 522]);
  assert.equal(model.items[0].taxable + model.items[0].cgst + model.items[0].sgst, 21900);
  assert.deepEqual(model.taxSummary.map((line) => line.amount), [20857, 521, 522]);
});

test('mixed rates, quantities and discounts reconcile in paise and preserve coupon eligibility', () => {
  const model = invoice.buildOrderInvoiceModel(taxOrder({
    items: [taxItem({ price: 105, quantity: 2 }), taxItem({ price: 118, gstRate: 18 }), taxItem({ price: 30, gstRate: 0 })],
    coupon_discount: 69, coupon_details: { productDiscount: 20, freeShipping: 49, itemDiscounts: [2000, 0, 0] }, total: 338,
  }));
  assert.deepEqual(model.items.map((item) => item.netTotal), [19000, 11800, 3000]);
  assert.deepEqual(model.items.map((item) => item.taxable), [18095, 10000, 3000]);
  assert.deepEqual(model.items.map((item) => item.tax), [905, 1800, 0]);
  assert.equal(model.items.reduce((sum, item) => sum + item.taxable + item.tax, 0), 33800);
  assert.equal(model.totals.reduce((sum, line) => sum + line.amount, 0), model.total);
  assert.equal(model.taxSummary[1].amount, 2705);
});

test('line totals multiply quantity before extracting GST, including paise-priced and free items', () => {
  for (const price of [0, 0.01, 0.1, 219, 9999.99]) for (const quantity of [1, 2, 7]) for (const gstRate of [0, 5, 5.25, 18, 28, 40]) {
    const item = invoice.buildOrderInvoiceModel(taxOrder({ items: [taxItem({ price, quantity, gstRate })], total: price * quantity + 49 })).items[0];
    assert.equal(item.netTotal, Math.round(price * 100) * quantity);
    assert.equal(item.taxable + item.tax, item.netTotal);
    assert.equal(item.igst, item.tax);
  }
});

test('legacy missing tax snapshots stay unavailable and explicit zero remains a configured rate', () => {
  const legacy = invoice.buildOrderInvoiceModel(fixture);
  assert.equal(legacy.items[0].gstRate, null);
  assert.equal(legacy.items[0].taxable, null);
  assert.equal(legacy.taxComplete, false);
  assert.deepEqual(legacy.taxSummary, []);
  const zero = invoice.buildOrderInvoiceModel(taxOrder({ items: [taxItem({ gstRate: 0 })] }));
  assert.equal(zero.items[0].tax, 0);
  assert.equal(zero.items[0].taxable, 21900);
  assert.equal(zero.taxComplete, true);
});

test('invalid GST snapshots, discounts and unknown taxable destinations fail with clear validation', () => {
  for (const gstRate of [-1, 101, 'bad', 5.123]) assert.throws(() => invoice.buildOrderInvoiceModel(taxOrder({ items: [taxItem({ gstRate })] })), /invalid GST rate/);
  assert.throws(() => invoice.buildOrderInvoiceModel(taxOrder({ shipping_address: { state: 'Unknown' } })), /recognised delivery state/);
  assert.throws(() => invoice.buildOrderInvoiceModel(taxOrder({ coupon_discount: 20, coupon_details: { productDiscount: 20, itemDiscounts: [1999] } })), /invalid saved item discounts/);
});

test('rendered PDFs include HSN, unit, quantity, rate, taxable, GST, IGST and line price', async () => {
  const text = await renderedInvoiceText(taxOrder());
  for (const label of ['HSN', 'Unit', 'Qty', 'Rate', 'Taxable', 'GST', 'IGST', 'Price', '9503', 'SET', '208.57', '10.43', '268.00']) assert.ok(text.includes(label), label);
  assert.match(await renderedInvoiceText(taxOrder({ shipping_address: fixture.shipping_address })), /CGST\+SGST[\s\S]*CGST \(included\)[\s\S]*SGST \(included\)/);
});

async function renderedInvoiceText(row) {
  const PDFDocument = require('pdfkit');
  const originalText = PDFDocument.prototype.text;
  const drawn = [];
  PDFDocument.prototype.text = function (value, ...args) {
    drawn.push(String(value));
    return originalText.call(this, value, ...args);
  };
  try {
    await invoice.buildOrderInvoicePdf(row);
    return drawn.join('\n');
  } finally { PDFDocument.prototype.text = originalText; }
}

test('invoice PDFs show billing only for matching or missing legacy billing addresses and omit empty alternate numbers', async () => {
  for (const billing of [{}, JSON.stringify({ ...fixture.shipping_address, alternateMobile: '  ' })]) {
    const text = await renderedInvoiceText({ ...fixture, billing_address: billing });
    assert.match(text, /Billing Details/);
    assert.doesNotMatch(text, /Shipping Details|Alt No\./);
  }
});

test('address comparison ignores formatting, legacy field names and contact metadata', () => {
  const billing = {
    name: ' BIKRAM   PAUL ', addressLine1: ' TEMPLE ROAD ', line2: 'near gate 2',
    city: 'MATHURA', state: 'UTTAR PRADESH', postalCode: 281001,
    email: 'billing@example.com', phone: '9876543211', id: 'saved-billing',
  };
  assert.equal(invoice.buildOrderInvoiceModel({ ...fixture, billing_address: JSON.stringify(billing) }).showShippingAddress, false);
  for (const field of ['fullName', 'street', 'addressLine2', 'city', 'state', 'pincode']) {
    assert.equal(invoice.buildOrderInvoiceModel({ ...fixture, billing_address: { ...fixture.shipping_address, [field]: 'Different' } }).showShippingAddress, true, field);
  }
});

test('invoice PDFs show distinct shipping addresses and supplied alternate numbers in the correct section', async () => {
  const text = await renderedInvoiceText({
    ...fixture,
    billing_address: { ...fixture.shipping_address, street: 'Office 12, Commercial Complex', alternateMobile: ' ', alternatePhone: '9876543212' },
    shipping_address: { ...fixture.shipping_address, altMobile: '9876543213' },
  });
  assert.match(text, /Billing Details[\s\S]*Alt No\.:\n9876543212[\s\S]*Shipping Details[\s\S]*Alt No\.:\n9876543213/);
});

test('a shared address retains an alternate number stored only with shipping', async () => {
  const text = await renderedInvoiceText({ ...fixture, billing_address: { ...fixture.shipping_address }, shipping_address: { ...fixture.shipping_address, altPhone: '9876543214' } });
  assert.match(text, /Alt No\.:\n9876543214/);
  assert.doesNotMatch(text, /Shipping Details/);
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
  assert.match(response.headers['content-disposition'], /attachment; filename="BrajMart-Invoice-10339.pdf"; filename\*=UTF-8''Bikram%20Paul%20-%202026-10-14%20-%20Invoice-10339.pdf/);
  assert.equal(response.headers['access-control-expose-headers'], 'Content-Disposition');
  assert.equal(response.body.subarray(0, 5).toString(), '%PDF-');
  assert.match(response.body.toString('latin1'), /\/Count 1\b/);
  assert.equal(response.headers['cache-control'], 'private, no-store');
});

test('Hindi names and addresses containing रे render completely without the NULL-anchor font crash', async () => {
  const pdf = await invoice.buildOrderInvoicePdf({
    ...fixture,
    shipping_address: { ...fixture.shipping_address, fullName: 'रेखा', street: 'रेती मार्ग, प्रेरणा भवन' },
    items: [{ name: 'रेशमी माला', sku: 'TEST-21', quantity: 1, price: 100 }],
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.subarray(-1024).toString().trimEnd().endsWith('%%EOF'));
  assert.match(pdf.toString('latin1'), /\/Count 1\b/);
});
test('invoice endpoints enforce admin authorization', async () => {
  for (const path of ['/:id/invoice', '/admin/invoices', '/admin/invoices.zip']) {
    assert.equal((await request(path, { token: false })).statusCode, 401);
    assert.equal((await request(path, { role: 'customer' })).statusCode, 403);
  }
  assert.equal(state.queries.length, 0);
});

test('unfiltered invoice manifest lists dated customer filenames across all pages without PDF rendering', async () => {
  state.orders = Array.from({ length: 133 }, (_, index) => ({ ...fixture, id: 10000 + index }));
  const response = await request('/admin/invoices', { query: { page: 2 } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  const entries = JSON.parse(response.body.toString()).invoices;
  assert.equal(entries.length, 133);
  assert.deepEqual(entries[0], { orderId: '10000', filename: 'Bikram Paul - 2026-10-14 - Invoice-10000.pdf' });
  assert.deepEqual(entries.at(-1), { orderId: '10132', filename: 'Bikram Paul - 2026-10-14 - Invoice-10132.pdf' });
  assert.equal(state.queries.length, 1);
  assert.match(state.queries[0].sql, /ORDER BY id ASC/);
});

test('invoice manifest reports an empty list and database outages without creating an archive', async () => {
  state.orders = [];
  assert.deepEqual(JSON.parse((await request('/admin/invoices')).body.toString()), { invoices: [] });
  state.connected = false;
  assert.equal((await request('/admin/invoices')).statusCode, 503);
});

test('orders, invoice manifest and every ZIP batch share customer, status, search and date filters', async () => {
  state.orders = Array.from({ length: 101 }, (_, index) => ({ ...fixture, id: 10000 + index }));
  const payments = require('../src/routes/payments');
  const reconcile = payments.triggerRecentRazorpayReconciliation;
  const build = invoice.buildOrderInvoicePdf;
  payments.triggerRecentRazorpayReconciliation = () => {};
  invoice.buildOrderInvoicePdf = async (row) => Buffer.from(`%PDF-1.4\n${row.id}\n%%EOF`);
  const query = { search: 'AWB', customer: 'Paul', status: 'confirmed,shipped', dateFrom: '2026-10-14', dateTo: '2026-10-14', page: '2' };
  const expected = [...Array(8).fill('%awb%'), '%paul%', 'confirmed', 'shipped', new Date('2026-10-13T18:30:00Z'), new Date('2026-10-14T18:30:00Z')];
  try {
    for (const path of ['/', '/admin/invoices', '/admin/invoices.zip']) assert.equal((await request(path, { query })).statusCode, 200);
    const queries = state.queries.filter(({ sql }) => sql.includes('FROM orders'));
    assert.equal(queries.length, 6); // table, manifest, snapshot, two batches and final empty batch
    for (const { sql, params } of queries) {
      assert.match(sql, /status IN \(\?,\?\)/);
      assert.match(sql, /created_at >= \? AND created_at < \?/);
      assert.match(sql, /JSON_EXTRACT/);
      assert.deepEqual(sql.includes('id > ?') ? params.slice(2) : params, expected);
    }
  } finally {
    payments.triggerRecentRazorpayReconciliation = reconcile;
    invoice.buildOrderInvoicePdf = build;
  }
});

test('invoice endpoints reject reversed dates and unknown statuses before querying orders', async () => {
  for (const path of ['/admin/invoices', '/admin/invoices.zip']) {
    for (const query of [{ dateFrom: '2026-11-04', dateTo: '2026-11-01' }, { status: 'unknown' }]) {
      assert.equal((await request(path, { query })).statusCode, 400);
    }
  }
  assert.equal(state.queries.length, 0);
});
test('all invoices ZIP spans database batches and ignores table pagination', async () => {
  state.orders = Array.from({ length: 101 }, (_, index) => ({ ...fixture, id: 10000 + index, items: [{ ...fixture.items[0], sku: '', productId: '21' }] }));
  state.products = [{ id: 21, sku: 'TMK-21' }];
  const originalBuild = invoice.buildOrderInvoicePdf;
  invoice.buildOrderInvoicePdf = async (row) => {
    assert.equal(row.items[0].sku, 'TMK-21');
    return Buffer.from(`%PDF-1.4\nOrder ${row.id}\n%%EOF`);
  };
  try {
    const response = await request('/admin/invoices.zip', { query: { page: 2 } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/zip');
    assert.equal(response.headers['x-invoice-count'], '101');
    assert.equal(response.body.subarray(0, 2).toString(), 'PK');
    const end = response.body.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.equal(response.body.readUInt16LE(end + 10), 101, 'ZIP central directory contains every invoice');
    assert.ok(response.body.includes(Buffer.from('Bikram Paul - 2026-10-14 - Invoice-10000.pdf')));
    assert.ok(response.body.includes(Buffer.from('Bikram Paul - 2026-10-14 - Invoice-10100.pdf')));
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

test('invoice filenames preserve customer names safely and distinguish repeat customers by order', () => {
  assert.equal(invoice.orderInvoiceFilename(10339, fixture), 'Bikram Paul - 2026-10-14 - Invoice-10339.pdf');
  assert.equal(invoice.orderInvoiceFilename(10340, fixture), 'Bikram Paul - 2026-10-14 - Invoice-10340.pdf');
  assert.equal(invoice.orderInvoiceFilename(10339, { ...fixture, created_at: '2026-10-14T20:00:00Z' }), 'Bikram Paul - 2026-10-15 - Invoice-10339.pdf');
  assert.equal(invoice.orderInvoiceFilename(1, { shipping_address: '{"fullName":"रेखा देवी"}', customer_name: 'Account Name' }), 'रेखा देवी - Invoice-1.pdf');
  assert.equal(invoice.orderInvoiceFilename(2, { customer_name: '  A/B:C*D?E"F<G>H|I\\J\nK  ' }), 'A B C D E F G H I J K - Invoice-2.pdf');
  assert.equal(invoice.orderInvoiceFilename(3, { customer_name: '../..' }), 'Customer - Invoice-3.pdf');
  assert.equal(invoice.orderInvoiceFilename(4, { customer_name: 'Fallback Name', shipping_address: '{}' }), 'Fallback Name - Invoice-4.pdf');
  assert.equal(invoice.orderInvoiceFilename(5), 'Customer - Invoice-5.pdf');
  assert.equal(invoice.orderInvoiceFilename(6, { customer_name: 'A'.repeat(200) }), `${'A'.repeat(80)} - Invoice-6.pdf`);
});

test('legacy invoices resolve missing SKUs without changing stored prices, totals or saved SKUs', async () => {
  const { resolveInvoiceOrderSkus } = require('../src/lib/orderInvoiceExport');
  state.products = [{ id: 21, name: 'Renamed product', sku: 'BM-000021', price: 999 }];
  const original = { ...fixture, items: JSON.stringify([
    { productId: '21', name: 'Original Mala', quantity: 1, price: 100, selectedSize: 'Large' },
    { productId: '21', name: 'Another Mala', quantity: 1, price: 50, sku: 'HISTORICAL-SKU' },
  ]) };
  const [resolved] = await resolveInvoiceOrderSkus([original]);
  assert.deepEqual(resolved.items, [
    { productId: '21', name: 'Original Mala', quantity: 1, price: 100, selectedSize: 'Large', sku: 'BM-000021' },
    { productId: '21', name: 'Another Mala', quantity: 1, price: 50, sku: 'HISTORICAL-SKU' },
  ]);
  assert.equal(typeof original.items, 'string');
  assert.equal(resolved.total, original.total);
  assert.equal(state.queries.length, 1);
  assert.deepEqual(state.queries[0].params, ['21']);
  assert.doesNotMatch(state.queries[0].sql, /archived_at IS NULL/);
});

test('legacy SKU matches require a known ID or a unique exact slug/name; ambiguous or deleted products stay unassigned', async () => {
  const { resolveInvoiceOrderSkus } = require('../src/lib/orderInvoiceExport');
  state.products = [
    { id: 1, name: 'Unique Mala', slug: 'unique', sku: 'SKU-1' },
    { id: 2, name: 'Duplicate Mala', slug: 'other', sku: 'SKU-2' },
    { id: 3, name: 'Duplicate Mala', slug: 'third', sku: 'SKU-3' },
    { id: 4, name: 'Cow Ghee', slug: 'ghee', sku: 'SKU-4' },
  ];
  const [resolved] = await resolveInvoiceOrderSkus([{ items: [
    { name: 'Unique Mala' }, { slug: 'other' }, { name: 'Duplicate Mala' },
    { productId: '999', name: 'Unique Mala' }, { slug: 'missing', name: 'Unique Mala' },
    { sku: '  ', selectedSku: 'SAVED-VARIANT' },
    { name: 'Cow Ghee (Size: 1L)', selectedSize: '1L' },
    { name: 'Cow Ghee (Size: 1L)', selectedSize: '500ml' },
  ] }]);
  assert.deepEqual(resolved.items.map(invoice.storedInvoiceItemSku), ['SKU-1', 'SKU-2', '', '', '', 'SAVED-VARIANT', 'SKU-4', '']);
  assert.equal(resolved.items[6].name, 'Cow Ghee (Size: 1L)');
});

test('a single legacy invoice passes the recovered SKU into the PDF renderer', async () => {
  state.orders = [{ ...fixture, items: [{ productId: '21', name: 'Mala', price: 100, quantity: 1 }] }];
  state.products = [{ id: 21, sku: 'BM-000021' }];
  const originalBuild = invoice.buildOrderInvoicePdf;
  invoice.buildOrderInvoicePdf = async (row) => {
    assert.equal(row.items[0].sku, 'BM-000021');
    assert.equal(row.items[0].price, 100);
    return Buffer.from('%PDF-1.4\nTest\n%%EOF');
  };
  try { assert.equal((await request('/:id/invoice', { params: { id: String(fixture.id) } })).statusCode, 200); }
  finally { invoice.buildOrderInvoicePdf = originalBuild; }
});
