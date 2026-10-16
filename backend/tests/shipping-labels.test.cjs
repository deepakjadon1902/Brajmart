const assert = require('node:assert/strict');
const { after, beforeEach, test } = require('node:test');
const path = require('node:path');

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
let state;

function stub(relative, exports) {
  const id = require.resolve(path.join('../src', relative));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const db = require('../src/lib/db');
db.withDbTransaction = async (fn) => fn({});
db.dbQuery = async (sql) => {
  state.queries.push(sql);
  if (sql.includes("SHOW COLUMNS FROM orders LIKE 'status'")) {
    return [{ Type: "enum('pending_payment','confirmed','processing','shipped','out_for_delivery','delivered','rto','cancelled')" }];
  }
  if (sql.includes('FROM order_shipping_labels')) return state.mapping ? [state.mapping] : [];
  if (sql.includes('FROM orders')) {
    if (sql.includes('FROM payments') && !state.orderVisible) return [];
    return state.order ? [state.order] : [];
  }
  throw new Error(`Unexpected test query: ${sql}`);
};
db.dbExecute = async (sql, params = []) => {
  state.writes.push({ sql, params });
  if (sql.includes('INSERT IGNORE INTO order_shipping_labels')) {
    if (state.mapping) return { affectedRows: 0 };
    state.mapping = {
      order_id: params[0], external_label_id: params[1], tracking_id: params[2], courier_name: params[3],
      external_status: 'Creating', created_at: new Date(), updated_at: new Date(),
    };
    return { affectedRows: 1 };
  }
  if (sql.includes('INSERT INTO order_shipping_labels')) {
    state.mapping = {
      order_id: params[0], external_label_id: params[1], tracking_id: params[2], courier_name: params[3],
      external_status: params[4], raw_courier_status: params[5], updated_at: new Date(),
    };
  }
  if (sql.includes('SET external_label_id = ?')) {
    if (state.claimLost || state.mapping?.external_label_id !== params[2]) return { affectedRows: 0 };
    state.mapping = { ...state.mapping, external_label_id: params[0], external_status: 'Creating', updated_at: new Date() };
  }
  if (sql.includes('DELETE FROM order_shipping_labels') && state.mapping?.external_label_id === params[1]) state.mapping = null;
  if (sql.includes('UPDATE orders SET status = ?')) {
    state.order = { ...state.order, status: params[0], status_history: params[1] };
  }
  if (sql.includes('SET tracking_id = ?')) {
    state.mapping = { ...state.mapping, tracking_id: params[0], courier_name: params[1], external_status: params[2], raw_courier_status: params[3] };
  }
  return { affectedRows: 1 };
};

stub('lib/email', { sendShippingUpdate: async () => {} });
stub('lib/inventory', { convertReservationToSale: async () => {} });

const shipping = require('../src/lib/shippingLabels');

const order = () => ({
  id: 10339,
  items: JSON.stringify([{ name: 'Tulsi Mala', quantity: 2 }]),
  total: 302,
  status: 'confirmed',
  customer_name: 'Bikram Paul',
  customer_email: 'customer@example.com',
  shipping_address: JSON.stringify({
    fullName: 'Bikram Paul', street: 'Temple Road', addressLine2: 'Near Gate 2', city: 'Mathura',
    state: 'Uttar Pradesh', pincode: '281001', mobile: '9876543210',
  }),
  payment_method: 'Razorpay',
  tracking_id: 'AWB10339',
  shipping_service: 'Shree Maruti',
});

beforeEach(() => {
  state = {
    mapping: null,
    queries: [],
    writes: [],
    requests: [],
    labelPosts: 0,
    handoffPosts: 0,
    remoteLabels: [],
    missingLabelStatus: 404,
    claimLost: false,
    order: order(),
    orderVisible: true,
    remoteLabel: null,
    refreshPosts: 0,
    refreshResponse: { ok: true, skipped: false },
    refreshedLabel: { status: 'Shipped', raw_courier_status: 'In Transit', last_successful_sync: '2026-10-15T08:00:00.000Z' },
    handoffUrl: 'https://labels.example.test/api/v1/auth/print-handoffs/redeem?token=one-time-token',
  };
  process.env.SHIPPING_LABELS_APP_URL = 'https://labels.example.test';
  process.env.SHIPPING_LABELS_API_URL = 'https://labels.example.test/api/v1';
  process.env.SHIPPING_LABELS_USERNAME = 'integration-user';
  process.env.SHIPPING_LABELS_PASSWORD = 'integration-password';
  global.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    state.requests.push({ target, options });
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'set-cookie': 'brajmart_session=test-session; Path=/; HttpOnly; Secure' },
      });
    }
    assert.equal(options.headers.Cookie, 'brajmart_session=test-session');
    if (target.pathname.endsWith('/labels') && (!options.method || options.method === 'GET')) {
      return new Response(JSON.stringify(state.remoteLabels), { status: 200 });
    }
    if (target.pathname.endsWith('/labels') && options.method === 'POST') {
      state.labelPosts++;
      const body = JSON.parse(options.body);
      state.remoteLabel = { id: 'label-10339', ...body };
      return new Response(JSON.stringify(state.remoteLabel), { status: 201 });
    }
    if (target.pathname.endsWith('/labels/label-10339')) {
      state.remoteLabel = {
        id: 'label-10339', status: 'Pending', courier_name: 'Shree Maruti Courier',
        tracking_id: 'AWB10339', order_reference: '10339',
        ...state.remoteLabel,
        ...(options.method === 'PATCH' ? JSON.parse(options.body) : {}),
      };
      return new Response(JSON.stringify(state.remoteLabel), { status: 200 });
    }
    if (target.pathname.endsWith('/labels/deleted-label')) {
      return new Response(JSON.stringify({ error: 'Label not found' }), { status: state.missingLabelStatus });
    }
    if (target.pathname.endsWith('/tracking/labels/label-10339/refresh') && options.method === 'POST') {
      state.refreshPosts++;
      if (state.refreshResponse.ok && !state.refreshResponse.skipped && !state.refreshResponse.error) {
        state.remoteLabel = { ...state.remoteLabel, ...state.refreshedLabel };
      }
      return new Response(JSON.stringify(state.refreshResponse), { status: 200 });
    }
    if (target.pathname.endsWith('/auth/print-handoffs') && options.method === 'POST') {
      state.handoffPosts++;
      assert.deepEqual(JSON.parse(options.body), { label_id: 'label-10339' });
      return new Response(JSON.stringify({
        redeem_url: state.handoffUrl,
        expires_in: 90,
      }), { status: 201 });
    }
    throw new Error(`Unexpected labels request: ${target.pathname}`);
  };
});

after(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

test('maps complete BrajMart order data into the labels application contract', () => {
  const payload = shipping.buildShippingLabelPayload(order());
  assert.equal(payload.receiver_name, 'Bikram Paul');
  assert.equal(payload.receiver_address_line1, 'Temple Road');
  assert.equal(payload.receiver_address_line2, 'Near Gate 2');
  assert.equal(payload.courier_name, 'Shree Maruti Courier');
  assert.equal(payload.tracking_id, 'AWB10339');
  assert.equal(payload.order_reference, '10339');
  assert.equal(payload.status, 'Pending');
  assert.match(payload.notes, /PREPAID/);
  assert.match(payload.notes, /2 item/);
});

test('rejects incomplete labels before any external request is made', () => {
  const missingAwb = { ...order(), tracking_id: '' };
  assert.throws(() => shipping.buildShippingLabelPayload(missingAwb), /missing tracking\/AWB/);
  assert.equal(state.requests.length, 0);
});

test('creates one remote label, stores its mapping, and reuses it on the next click', async () => {
  const first = await shipping.createOrUpdateShippingLabel(order());
  assert.equal(first.created, true);
  assert.equal(first.printUrl, 'https://labels.example.test/api/v1/auth/print-handoffs/redeem?token=one-time-token');
  assert.equal(state.mapping.external_label_id, 'label-10339');
  assert.equal(state.labelPosts, 1);

  const second = await shipping.createOrUpdateShippingLabel(order());
  assert.equal(second.created, false);
  assert.equal(second.label.id, 'label-10339');
  assert.equal(state.labelPosts, 1, 'second print must not create a duplicate remote label');
  assert.equal(state.handoffPosts, 2, 'each print click must receive a fresh one-time handoff');
});

test('rejects a print handoff URL outside the configured labels API origin', async () => {
  state.handoffUrl = 'https://attacker.example/steal-session';
  await assert.rejects(() => shipping.createOrUpdateShippingLabel(order()), /untrusted print handoff URL/);
});

const staleMapping = () => ({
  order_id: 10339,
  external_label_id: 'deleted-label',
  tracking_id: 'AWB10339',
  courier_name: 'Shree Maruti Courier',
  external_status: 'Pending',
});

test('replaces a deleted remote label and reuses the repaired mapping on the next print', async () => {
  state.mapping = staleMapping();
  const result = await shipping.createOrUpdateShippingLabel(order());
  assert.equal(result.created, true);
  assert.equal(result.label.id, 'label-10339');
  assert.equal(state.mapping.external_label_id, 'label-10339');
  assert.equal(state.labelPosts, 1);
  assert.equal(state.handoffPosts, 1);

  const second = await shipping.createOrUpdateShippingLabel(order());
  assert.equal(second.created, false);
  assert.equal(state.labelPosts, 1);
  assert.equal(state.handoffPosts, 2);
});

test('recovers a deleted label when updating its courier or AWB', async () => {
  state.mapping = staleMapping();
  const result = await shipping.createOrUpdateShippingLabel({ ...order(), tracking_id: 'NEW-AWB' });
  assert.equal(result.created, true);
  assert.equal(result.label.tracking_id, 'NEW-AWB');
  assert.equal(state.mapping.tracking_id, 'NEW-AWB');
  assert.equal(state.requests.find(({ target }) => target.pathname.endsWith('/labels/deleted-label')).options.method, 'PATCH');
});

test('recovers an existing replacement by order reference without creating a duplicate', async () => {
  state.mapping = staleMapping();
  state.remoteLabels = [{ id: 'label-10339', order_reference: '10339', tracking_id: 'OLD-AWB', courier_name: 'DTDC', status: 'Pending' }];
  const result = await shipping.createOrUpdateShippingLabel(order());
  assert.equal(result.created, false);
  assert.equal(state.labelPosts, 0);
  assert.equal(result.label.tracking_id, 'AWB10339');
  assert.equal(result.label.courier_name, 'Shree Maruti Courier');
  assert.equal(state.mapping.external_label_id, 'label-10339');
  assert.equal(state.requests.find(({ target }) => target.pathname.endsWith('/labels/label-10339')).options.method, 'PATCH');
});

test('does not replace labels on authentication or service errors', async () => {
  for (const status of [403, 503]) {
    state.mapping = staleMapping();
    state.missingLabelStatus = status;
    await assert.rejects(() => shipping.createOrUpdateShippingLabel(order()), { status: status === 503 ? 502 : status });
    assert.equal(state.mapping.external_label_id, 'deleted-label');
    assert.equal(state.labelPosts, 0);
    assert.equal(state.handoffPosts, 0);
  }
});

test('a concurrent recovery cannot create a duplicate replacement', async () => {
  state.mapping = staleMapping();
  state.claimLost = true;
  await assert.rejects(() => shipping.createOrUpdateShippingLabel(order()), /already being created/);
  assert.equal(state.labelPosts, 0);
  assert.equal(state.handoffPosts, 0);
});

test('a live database claim blocks a concurrent duplicate label request', async () => {
  state.mapping = {
    order_id: 10339,
    external_label_id: 'pending:another-server',
    tracking_id: 'AWB10339',
    courier_name: 'Shree Maruti Courier',
    external_status: 'Creating',
    created_at: new Date(),
    updated_at: new Date(),
  };
  await assert.rejects(() => shipping.createOrUpdateShippingLabel(order()), /already being created/);
  assert.equal(state.labelPosts, 0);
});

test('sync works before the first print, applies courier progress, and reuses the label on later syncs', async () => {
  const first = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(first.updated, true);
  assert.equal(first.orderStatus, 'shipped');
  assert.equal(state.mapping.external_label_id, 'label-10339');
  assert.equal(state.labelPosts, 1);
  assert.equal(state.refreshPosts, 1);
  assert.equal(state.handoffPosts, 0, 'sync must not depend on a print handoff');
  assert.match(state.order.status_history, /Courier verified/);
  assert.ok(state.queries.some((sql) => sql.includes('FROM orders') && sql.includes('FROM payments')));

  const second = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(second.updated, false);
  assert.equal(state.labelPosts, 1);
  assert.equal(state.refreshPosts, 2);
  assert.equal(state.handoffPosts, 0);
});

test('sync links a manually created label with matching courier/AWB instead of creating another', async () => {
  state.remoteLabels = [{ id: 'label-10339', order_reference: null, tracking_id: 'AWB10339', courier_name: 'Shree Maruti Courier', status: 'Shipped' }];
  const result = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(result.orderStatus, 'shipped');
  assert.equal(state.labelPosts, 0);
  assert.equal(state.refreshPosts, 1);
  assert.equal(state.handoffPosts, 0);
  const patch = state.requests.find(({ target, options }) => target.pathname.endsWith('/labels/label-10339') && options.method === 'PATCH');
  assert.equal(JSON.parse(patch.options.body).order_reference, '10339');
});

test('sync never claims a label already assigned to a different order', async () => {
  state.remoteLabels = [{ id: 'another-order-label', order_reference: '99999', tracking_id: 'AWB10339', courier_name: 'Shree Maruti Courier', status: 'Shipped' }];
  await shipping.syncShippingLabelForOrder(10339);
  assert.equal(state.labelPosts, 1);
  assert.ok(!state.requests.some(({ target }) => target.pathname.endsWith('/labels/another-order-label')));
});

test('sync repairs a deleted mapping and refreshes its replacement without printing', async () => {
  state.mapping = staleMapping();
  const result = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(result.updated, true);
  assert.equal(state.mapping.external_label_id, 'label-10339');
  assert.equal(state.labelPosts, 1);
  assert.equal(state.refreshPosts, 1);
  assert.equal(state.handoffPosts, 0);
});

test('sync updates the saved AWB in the labels service before asking the courier for status', async () => {
  state.mapping = { ...staleMapping(), external_label_id: 'label-10339' };
  state.order.tracking_id = 'NEW-AWB';
  await shipping.syncShippingLabelForOrder(10339);
  const patchIndex = state.requests.findIndex(({ options }) => options.method === 'PATCH');
  const refreshIndex = state.requests.findIndex(({ target }) => target.pathname.endsWith('/refresh'));
  assert.ok(patchIndex >= 0 && patchIndex < refreshIndex);
  assert.equal(JSON.parse(state.requests[patchIndex].options.body).tracking_id, 'NEW-AWB');
  assert.equal(state.mapping.tracking_id, 'NEW-AWB');
  assert.equal(state.labelPosts, 0);
});

test('sync rejects invisible orders and missing AWBs before contacting the labels service', async () => {
  state.orderVisible = false;
  await assert.rejects(() => shipping.syncShippingLabelForOrder(10339), { status: 404 });
  assert.equal(state.requests.length, 0);
  state.orderVisible = true;
  state.order.tracking_id = '';
  await assert.rejects(() => shipping.syncShippingLabelForOrder(10339), /missing tracking\/AWB/);
  assert.equal(state.requests.length, 0);
  assert.equal(state.mapping, null);
});

test('courier failures leave the order status unchanged and allow retry with the same label', async () => {
  for (const response of [
    { skipped: true, reason: 'Courier cooldown' },
    { ok: false },
    { ok: false, error: 'Courier unavailable' },
  ]) {
    state.refreshResponse = response;
    await assert.rejects(() => shipping.syncShippingLabelForOrder(10339), { status: 502 });
    assert.equal(state.order.status, 'confirmed');
    assert.equal(state.labelPosts, 1);
    assert.equal(state.handoffPosts, 0);
  }
  state.refreshResponse = { ok: true };
  const result = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(result.orderStatus, 'shipped');
  assert.equal(state.labelPosts, 1);
});

test('manual Delivered label status does not skip courier verification or mark an order delivered', async () => {
  state.mapping = { ...staleMapping(), external_label_id: 'label-10339', external_status: 'Delivered' };
  state.remoteLabel = { id: 'label-10339', status: 'Delivered' };
  state.refreshedLabel = { ...state.refreshedLabel, status: 'Delivered' };
  const result = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(state.refreshPosts, 1);
  assert.equal(result.orderStatus, 'shipped');
});

test('sync can register a delivered shipment without downgrading it or making a print handoff', async () => {
  state.order.status = 'delivered';
  const result = await shipping.syncShippingLabelForOrder(10339);
  assert.equal(result.updated, false);
  assert.equal(result.orderStatus, 'delivered');
  assert.equal(state.refreshPosts, 1);
  assert.equal(state.handoffPosts, 0);
  await assert.rejects(() => shipping.createOrUpdateShippingLabel(state.order), { status: 409 });
});

test('maps only courier-owned progress and never downgrades terminal or advanced orders', () => {
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Pending' }), null);
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Delivered', raw_courier_status: 'Delivered' }), null, 'manual status without a successful courier sync is ignored');
  const courierEvidence = { last_successful_sync: '2026-10-15T08:00:00.000Z' };
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Shipped', raw_courier_status: 'In Transit', ...courierEvidence }), 'shipped');
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Shipped', raw_courier_status: 'OFD', tracking_event_description: 'Out For Delivery', ...courierEvidence }), 'out_for_delivery');
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Delivered', raw_courier_status: 'Successfully Delivered', ...courierEvidence }), 'delivered');
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'RTO', raw_courier_status: 'RTO Delivered', ...courierEvidence }), 'rto');
  assert.equal(shipping.normalizeShippingLabelStatus({ status: 'Delivered', raw_courier_status: 'In Transit', ...courierEvidence }), 'shipped', 'editable label status never overrides raw courier evidence');
  assert.equal(shipping.shouldApplyShippingLabelStatus('confirmed', 'shipped'), true);
  assert.equal(shipping.shouldApplyShippingLabelStatus('out_for_delivery', 'shipped'), false);
  assert.equal(shipping.shouldApplyShippingLabelStatus('delivered', 'rto'), false);
  assert.equal(shipping.shouldApplyShippingLabelStatus('cancelled', 'delivered'), false);
});

