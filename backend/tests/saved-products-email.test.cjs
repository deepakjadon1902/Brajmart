const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = require('../src/lib/db');
db.isDbConnected = () => false;
const { sendSavedProductsReminderEmail } = require('../src/lib/email');

test('saved-product email renders correct details, separate subtotals, safe links and an order message without real delivery', async () => {
  const oldFetch = global.fetch;
  const oldEnv = { ...process.env };
  const requests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    requests.push({ ...options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ id: 'mock-only' }) };
  };
  try {
    process.env.EMAIL_PROVIDER = 'resend'; process.env.RESEND_API_KEY = 'mock-key';
    process.env.EMAIL_FROM = 'sender@example.invalid'; process.env.FRONTEND_URL = 'https://store.example.invalid';
    await sendSavedProductsReminderEmail('recipient@example.invalid', {
      customerName: '<Private> customer', idempotencyKey: 'fixture-saved-products', unsubscribeUrl: 'https://store.example.invalid/email/unsubscribe#token=fixture',
      cartItems: [{ name: '<Current product>', slug: 'current product', sku: 'SKU-5', quantity: 2, price: 125.5,
        selectedSize: 'M', selectedPieces: 3, selectedAttributes: { material: 'Cotton & silk' } }],
      favoriteItems: [{ name: 'Favorite product', slug: 'favorite', quantity: 1, price: 75 }],
    });
    assert.equal(requests.length, 1);
    const { html, to, subject } = requests[0].body;
    assert.equal(to, 'recipient@example.invalid');
    assert.match(subject, /Ready to order/);
    for (const text of ['Your cart', 'Your favorites', 'Cart item subtotal: &#8377;251', 'Favorites value (1 each): &#8377;75',
      'SKU-5', 'Size: M', 'Pieces: 3', 'Cotton &amp; silk', '&lt;Current product&gt;', '&lt;Private&gt;',
      'https://store.example.invalid/product/current%20product', 'https://store.example.invalid/cart',
      'https://store.example.invalid/wishlist', '#token=fixture', 'Proceed with your order', 'calculated at checkout']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes('<Current product>'));
    assert.equal(requests[0].headers['Idempotency-Key'], 'fixture-saved-products');
  } finally {
    global.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});
