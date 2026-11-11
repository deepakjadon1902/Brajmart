const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeProductTaxFields, allocatePaise, invoiceStateCode } = require('../src/lib/productTax');
const db = require('../src/lib/db');
let products = [{ id: 21, sku: 'BM-21', name: 'Offering', price: 219, category: 'Idols', in_stock: 1, hsn_code: '9503', unit: 'SET', gst_rate: '5.00' }];
db.dbQuery = async (sql) => sql.includes('FROM coupons') ? [{ id: 1, code: 'SAVE', scope_type: 'product', scope_value: '21', discount_type: 'amount', discount_value: 20, free_shipping: 1, free_packaging: 0 }] : products;
const { priceAndValidateOrderItems, applyCouponToTotals } = require('../src/lib/orderPricing');

test('checkout saves database HSN/unit/rate and ignores forged customer tax fields', async () => {
  const priced = await priceAndValidateOrderItems([{ productId: '21', quantity: 2, price: 1, hsnCode: '1111', unit: 'KG', gstRate: 0 }]);
  assert.equal(priced.ok, true);
  assert.deepEqual([priced.items[0].hsnCode, priced.items[0].unit, priced.items[0].gstRate, priced.items[0].price], ['9503', 'SET', 5, 219]);
  assert.equal(priced.itemsSubtotal, 438);
  products[0].gst_rate = 18;
  assert.equal(priced.items[0].gstRate, 5, 'later product changes cannot change the saved snapshot');
  products[0].gst_rate = null;
  assert.equal((await priceAndValidateOrderItems([{ productId: '21' }])).items[0].gstRate, null);
});

test('admin tax validation preserves leading HSN zeroes and distinguishes missing rate from zero', () => {
  const data = { hsnCode: ' 0401 ', unit: ' kg ', gstRate: '5.25' };
  assert.equal(normalizeProductTaxFields(data), null);
  assert.deepEqual(data, { hsnCode: '0401', unit: 'KG', gstRate: 5.25 });
  for (const gstRate of [0, '0', '', null]) {
    const input = { gstRate };
    assert.equal(normalizeProductTaxFields(input), null);
    assert.equal(input.gstRate, gstRate === '' || gstRate === null ? null : 0);
  }
  for (const gstRate of [-1, 101, 'bad', true, [], {}, ' ', 5.123, 'Infinity']) assert.ok(normalizeProductTaxFields({ gstRate }));
  for (const hsnCode of ['123', '12345', '1234567', '123456789', 'ABCD', 9503]) assert.ok(normalizeProductTaxFields({ hsnCode }));
  assert.ok(normalizeProductTaxFields({ unit: '<script>' }));
  assert.ok(normalizeProductTaxFields({ unit: 'A'.repeat(17) }));
});

test('discount allocation uses integer paise without losing pennies or touching ineligible items', async () => {
  assert.deepEqual(allocatePaise(2, [1, 1, 1]), [1, 1, 0]);
  assert.deepEqual(allocatePaise(10, [0, 20, 10]), [0, 7, 3]);
  assert.throws(() => allocatePaise(4, [1, 1]), /Invalid/);
  const items = [{ productId: '21', price: 100, quantity: 1 }, { productId: '22', price: 200, quantity: 1 }];
  const result = await applyCouponToTotals('SAVE', items, { itemsSubtotal: 300, shipping: 49, packaging: 0, total: 349 });
  assert.equal(result.valid, true);
  assert.deepEqual(result.coupon.itemDiscounts, [2000, 0]);
  assert.equal(result.coupon.productDiscount, 20);
  assert.equal(result.coupon.discountAmount, 69);
  assert.equal(result.totals.total, 280);
});

test('place of supply accepts saved Indian names, state abbreviations and numeric GST codes', () => {
  for (const state of ['Uttar Pradesh', 'uttar-pradesh', 'U.P.', 'उत्तर प्रदेश', '09', 9]) assert.equal(invoiceStateCode(state), '09');
  assert.equal(invoiceStateCode('Madhya Pradesh'), '23');
  assert.equal(invoiceStateCode('DL'), '07');
  for (const state of ['', null, 'Unknown', 'USA']) assert.equal(invoiceStateCode(state), null);
});
