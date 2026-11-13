const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = require('../src/lib/db');

const product = {
  id: 28, name: 'Variant product', slug: 'variant-product', sku: 'BASE-28',
  price: 9999, original_price: null, image: '', category: 'Idols', category_id: 1,
  in_stock: 1, stock_quantity: 2, reserved_quantity: 0, archived_at: null,
  attributes: JSON.stringify([
    { slug: 'size-height', name: 'Height', terms: ['5"', '7"'] },
    { slug: 'color', name: 'Color', terms: ['Red', 'Blue'] },
  ]),
  variant_pricing: JSON.stringify([
    { selections: { 'size-height': '7"' }, price: 13990, sku: 'HEIGHT-7' },
  ]),
  sizes: '[]', size_pricing: '[]', piece_pricing: '[]',
};

db.isDbConnected = () => true;
db.dbQuery = async (sql) => {
  if (sql.includes('FROM settings')) return [{
    free_shipping_threshold: 299, shipping_fee: 49, tax_rate: 0,
    min_order_amount: 0, max_order_quantity: 10, cod_enabled: 1, cod_fee: 40,
  }];
  if (sql.includes('FROM products')) return [product];
  throw new Error('Unexpected query in checkout pricing test');
};

const { priceAndValidateOrderItems } = require('../src/lib/orderPricing');
const cartRouter = require('../src/routes/cart').default;
const validateHandler = cartRouter.stack.find((entry) => entry.route?.path === '/validate').route.stack[0].handle;

const validateCart = async (items) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await validateHandler({ body: { items } }, response);
  return response;
};

test('a catalog variant keeps its price through cart validation and final order pricing', async () => {
  const item = { productId: '28', quantity: 1, price: 13990, selectedAttributes: { 'size-height': '7"', color: 'Red' } };
  const cart = await validateCart([item]);
  assert.equal(cart.statusCode, 200);
  assert.deepEqual(cart.body.changes, []);
  assert.deepEqual(cart.body.unavailableItems, []);
  assert.equal(cart.body.items[0].price, 13990);
  assert.equal(cart.body.grandTotal, 13990);

  const order = await priceAndValidateOrderItems([item]);
  assert.equal(order.ok, true);
  assert.equal(order.itemsSubtotal, 13990);
  assert.equal(order.items[0].sku, 'HEIGHT-7');
  assert.equal(order.items[0].selectedAttributes.color, 'Red');
});

test('invalid variant options cannot be purchased at a forged client price', async () => {
  const item = { productId: '28', quantity: 1, price: 1, selectedAttributes: { 'size-height': '9"' } };
  const cart = await validateCart([item]);
  assert.equal(cart.body.unavailableItems[0].reason, 'invalid_selection');
  const order = await priceAndValidateOrderItems([item]);
  assert.equal(order.ok, false);
  assert.match(order.message, /option is no longer available/);
});

test('size and piece prices use catalog rules when no matching variant exists', async () => {
  const previous = {
    sizes: product.sizes,
    size_pricing: product.size_pricing,
    piece_pricing: product.piece_pricing,
  };
  product.sizes = JSON.stringify(['Small', 'Large']);
  product.size_pricing = JSON.stringify([{ size: 'Large', price: 11999 }]);
  product.piece_pricing = JSON.stringify([{ pieces: 2, price: 17500 }]);
  try {
    const sized = { productId: '28', quantity: 1, price: 11999, selectedSize: 'Large' };
    const sizedCart = await validateCart([sized]);
    assert.deepEqual(sizedCart.body.changes, []);
    assert.equal(sizedCart.body.items[0].price, 11999);
    const sizedOrder = await priceAndValidateOrderItems([sized]);
    assert.equal(sizedOrder.itemsSubtotal, 11999);

    const pieces = { productId: '28', quantity: 1, price: 17500, selectedPieces: 2 };
    const piecesCart = await validateCart([pieces]);
    assert.deepEqual(piecesCart.body.changes, []);
    assert.equal(piecesCart.body.items[0].price, 17500);
    const piecesOrder = await priceAndValidateOrderItems([pieces]);
    assert.equal(piecesOrder.itemsSubtotal, 17500);
  } finally {
    Object.assign(product, previous);
  }
});

test('cart and order pricing accept legacy selections and flag actual price changes', async () => {
  const selected = { productId: '28', quantity: 1, price: 9999, selections: { 'size-height': '7"' } };
  const cart = await validateCart([selected]);
  assert.equal(cart.body.items[0].price, 13990);
  assert.equal(cart.body.changes[0].type, 'price');
  assert.equal(cart.body.changes[0].currentPrice, 13990);
  const order = await priceAndValidateOrderItems([selected]);
  assert.equal(order.itemsSubtotal, 13990);
});

test('legacy size and piece selections remain compatible with catalog pricing', async () => {
  const previous = {
    sizes: product.sizes,
    size_pricing: product.size_pricing,
    piece_pricing: product.piece_pricing,
  };
  product.sizes = JSON.stringify(['Small', 'Large']);
  product.size_pricing = JSON.stringify([{ size: 'Large', price: 11999 }]);
  product.piece_pricing = JSON.stringify([{ pieces: 2, price: 17500 }]);
  try {
    const sized = await priceAndValidateOrderItems([{ productId: '28', quantity: 1, selections: { size: 'Large' } }]);
    assert.equal(sized.ok, true);
    assert.equal(sized.itemsSubtotal, 11999);
    const pieces = await priceAndValidateOrderItems([{ productId: '28', quantity: 1, selections: { pieces: '2' } }]);
    assert.equal(pieces.ok, true);
    assert.equal(pieces.itemsSubtotal, 17500);
  } finally {
    Object.assign(product, previous);
  }
});

test('multiple variant lines cannot reserve more than the product stock', async () => {
  const originalStock = product.stock_quantity;
  product.stock_quantity = 1;
  try {
    const items = [
      { productId: '28', quantity: 1, price: 13990, selectedAttributes: { 'size-height': '7"' } },
      { productId: '28', quantity: 1, price: 9999, selectedAttributes: { 'size-height': '5"' } },
    ];
    const cart = await validateCart(items);
    assert.equal(cart.body.items.length, 1);
    assert.equal(cart.body.unavailableItems[0].reason, 'out_of_stock');
    const order = await priceAndValidateOrderItems(items);
    assert.equal(order.ok, false);
    assert.match(order.message, /Only 1 available/);
  } finally {
    product.stock_quantity = originalStock;
  }
});
