// Synthetic fixtures only. This script does not connect to the database.
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildOrderInvoicePdf } = require('../src/lib/orderInvoice');
const fixture = require('../tests/fixtures/order-invoice.cjs');
(async () => {
  const output = path.resolve(__dirname, '../../output/pdf');
  const temporary = path.resolve(__dirname, '../../tmp/pdfs');
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir(temporary, { recursive: true });
  await fs.writeFile(path.join(output, 'brajmart-invoice-preview.pdf'), await buildOrderInvoicePdf(fixture, { method: 'UPI', transactionId: 'pay_example_10339' }));
  const long = { ...fixture, id: 10340, payment_method: 'COD', customer_name: 'श्री राधा गोविन्द',
    shipping_address: { ...fixture.shipping_address, fullName: 'श्री राधा गोविन्द', street: 'A very long apartment and building address near the Radha Govind temple, opposite the main entrance', addressLine2: 'Second floor, Building Seven, Raman Reti', alternateMobile: '9876543211' },
    billing_address: { fullName: 'Accounts Department', street: 'Office 12, Commercial Complex', city: 'New Delhi', state: 'Delhi', pincode: '110001', mobile: '9876543212' },
    items: Array.from({ length: 42 }, (_, i) => ({ name: `${i + 1}. तुलसी माला / Tulsi Kanthi Mala with a long descriptive product name`, sku: `TMK-${i + 1}`, quantity: 2, price: 100.25, selectedSize: 'Large', selectedAttributes: { Colour: 'Natural' } })),
    items_subtotal: 8421, shipping_amount: 49, packaging_amount: 84.21, cod_amount: 40, coupon_discount: 100, coupon_code: 'DEVOTION100', total: 8494.21,
  };
  await fs.writeFile(path.join(temporary, 'invoice-long-order.pdf'), await buildOrderInvoicePdf(long));
  const legacy = { ...fixture, id: 10341, items: [{ name: 'Tulsi Mala', quantity: 3, price: 0.1 }], total: 49.3, shipping_amount: null, packaging_amount: null, cod_amount: null, payment_method: 'COD' };
  await fs.writeFile(path.join(temporary, 'invoice-legacy-cod.pdf'), await buildOrderInvoicePdf(legacy));
  console.log('Invoice previews generated from synthetic fixtures.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
