const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const db = require('../src/lib/db');

const previousCourierType = "enum('DTDC','Shree Maruti','Delhivery','India Post','Ekart','Shadowfax','Amazon Shipping')";
const currentCourierType = previousCourierType.slice(0, -1) + ",'Blue Dart')";

let courierType;
let row;
let orderUpdates;

db.isDbConnected = () => true;
db.dbQuery = async (sql) => {
  db.assertNoRuntimeDdl(sql);
  if (sql.startsWith('SHOW COLUMNS')) return courierType ? [{ Type: courierType }] : [];
  if (sql.startsWith('SELECT id FROM orders')) return [];
  assert.match(sql, /FROM orders/);
  return [{ ...row }];
};
db.dbExecute = async (sql, params) => {
  db.assertNoRuntimeDdl(sql);
  if (sql.startsWith('UPDATE orders')) {
    orderUpdates.push(sql);
    const columns = [...sql.split(' WHERE ')[0].matchAll(/(\w+) = \?/g)].map((match) => match[1]);
    columns.forEach((column, index) => { row[column] = params[index]; });
  }
  return { affectedRows: 1 };
};

const orders = require('../src/routes/orders').default;
const updateOrder = orders.stack.find((layer) => layer.route?.path === '/:id/status').route.stack.at(-1).handle;

const saveOrder = async (body) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await updateOrder({ params: { id: '42' }, body }, response);
  return response;
};

beforeEach(() => {
  courierType = currentCourierType;
  row = { id: 42, items: '[]', total: 199, status: 'confirmed', shipping_service: 'DTDC', tracking_id: '12345', status_history: '[]' };
  orderUpdates = [];
});

test('Blue Dart persists and saving an AWB or order status preserves the saved courier', async () => {
  const changed = await saveOrder({ shippingService: 'Blue Dart' });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.data.shippingService, 'Blue Dart');
  assert.equal(changed.data.trackingId, '12345');
  assert.equal(changed.data.status, 'confirmed');
  assert.equal(row.shipping_service, 'Blue Dart');

  const tracked = await saveOrder({ trackingId: '79034111122' });
  assert.equal(tracked.statusCode, 200);
  assert.equal(tracked.data.shippingService, 'Blue Dart');
  assert.equal(tracked.data.trackingId, '79034111122');
  assert.doesNotMatch(orderUpdates[1], /shipping_service =/);

  const shipped = await saveOrder({ status: 'shipped' });
  assert.equal(shipped.data.status, 'shipped');
  assert.equal(shipped.data.shippingService, 'Blue Dart');
  assert.doesNotMatch(orderUpdates[2], /shipping_service =/);
});

test('an older courier list rejects a Blue Dart save before writing any order fields', async () => {
  courierType = previousCourierType;
  const response = await saveOrder({ shippingService: 'Blue Dart', trackingId: '79034111122', status: 'shipped' });
  assert.equal(response.statusCode, 409);
  assert.match(response.data.message, /Blue Dart shipping service migration/);
  assert.equal(orderUpdates.length, 0);
});

test('other couriers save on the older schema and a blank selection clears the courier', async () => {
  courierType = previousCourierType;
  const changed = await saveOrder({ shippingService: ' delhivery ' });
  assert.equal(changed.data.shippingService, 'Delhivery');

  const cleared = await saveOrder({ shippingService: '' });
  assert.equal(cleared.statusCode, 200);
  assert.equal(row.shipping_service, null);
  assert.equal(cleared.data.trackingId, '12345');
});
