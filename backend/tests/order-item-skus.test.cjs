const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = require('../src/lib/db');
db.dbQuery = async (sql, params) => {
  assert.match(sql, /SELECT id, sku,/);
  assert.deepEqual(params, ['21']);
  return [{ id: 21, sku: 'BM-000021', name: 'Tulsi Mala', slug: 'tulsi-mala', price: 100, in_stock: 1, stock_quantity: 10, reserved_quantity: 0 }];
};
const { priceAndValidateOrderItems } = require('../src/lib/orderPricing');

test('checkout snapshots the trusted product SKU for COD and Razorpay orders', async () => {
  const result = await priceAndValidateOrderItems([{ productId: '21', quantity: 2, sku: 'FORGED-CLIENT-SKU', price: 1 }]);
  assert.equal(result.ok, true);
  assert.equal(result.items[0].sku, 'BM-000021');
  assert.equal(result.items[0].price, 100);
  assert.equal(result.itemsSubtotal, 200);
});
