import dotenv from 'dotenv';
import { connectDb, dbExecute, dbQuery, withDbTransaction } from '../src/lib/db';
import { convertReservationToSale, releaseInventoryForOrder, reserveInventoryForOrder } from '../src/lib/inventory';
import type { PricedOrderItem } from '../src/lib/orderPricing';

dotenv.config({ path: '.env' });

const sku = `PHASE43_INVENTORY_IDEMPOTENCY_${Date.now()}`;
let productId = 0;
const orderIds: number[] = [];

const cleanup = async () => {
  if (!productId) return;
  await dbExecute('DELETE FROM inventory_transactions WHERE product_id = ?', [productId]).catch(() => {});
  if (orderIds.length) {
    await dbQuery(`DELETE FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds).catch(() => {});
  }
  await dbExecute('DELETE FROM products WHERE id = ? AND sku = ?', [productId, sku]).catch(() => {});
};

const createOrder = async (items: PricedOrderItem[]) => {
  const [result] = await Promise.all([
    dbExecute(
      `INSERT INTO orders
        (items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, estimated_delivery, status_history)
       VALUES (?, 198, 0, 0, 0, 0, 198, 'processing', 'Phase QA', 'phase43@example.invalid', '{}', '{}', 'Razorpay', NOW(), ?)`,
      [
        JSON.stringify(items),
        JSON.stringify([{ status: 'processing', date: new Date().toISOString(), note: 'Phase 4.3 idempotency test order' }]),
      ],
    ),
  ]);
  const id = Number((result as { insertId: number }).insertId);
  orderIds.push(id);
  return id;
};

const readState = async () => {
  const products = await dbQuery<any>(
    'SELECT stock_quantity, reserved_quantity, stock_quantity - reserved_quantity AS available, sold_count FROM products WHERE id = ?',
    [productId],
  );
  const transactions = await dbQuery<any>(
    'SELECT type, COUNT(*) AS count FROM inventory_transactions WHERE product_id = ? GROUP BY type ORDER BY type',
    [productId],
  );
  return { product: products[0], transactions };
};

const run = async () => {
  await connectDb();

  try {
    const created = await dbExecute(
      `INSERT INTO products
        (name, slug, sku, price, original_price, image, category, in_stock, stock_quantity, reserved_quantity, sold_count, low_stock_threshold, description)
       VALUES (?, ?, ?, 99, 129, '/placeholder.svg', 'Phase QA', 1, 5, 0, 0, 1, 'Phase 4.3 isolated inventory idempotency product')`,
      ['Phase 4.3 Inventory Idempotency Product', sku.toLowerCase(), sku],
    );
    productId = Number((created as { insertId: number }).insertId);

    const items: PricedOrderItem[] = [{
      productId: String(productId),
      slug: sku.toLowerCase(),
      name: 'Phase 4.3 Inventory Idempotency Product',
      image: '/placeholder.svg',
      category: 'Phase QA',
      quantity: 2,
      price: 99,
    }];

    const releaseOrderId = await createOrder(items);
    await withDbTransaction((connection) => reserveInventoryForOrder(connection, releaseOrderId, items));
    await withDbTransaction((connection) => reserveInventoryForOrder(connection, releaseOrderId, items));
    const afterReserveTwice = await readState();

    await withDbTransaction((connection) => releaseInventoryForOrder(connection, releaseOrderId, items));
    await withDbTransaction((connection) => releaseInventoryForOrder(connection, releaseOrderId, items));
    const afterReleaseTwice = await readState();

    const saleOrderId = await createOrder(items);
    await withDbTransaction((connection) => reserveInventoryForOrder(connection, saleOrderId, items));
    await withDbTransaction((connection) => convertReservationToSale(connection, saleOrderId, items));
    await withDbTransaction((connection) => convertReservationToSale(connection, saleOrderId, items));
    const afterSaleTwice = await readState();

    console.log(JSON.stringify({
      sku,
      orderIds,
      afterReserveTwice,
      afterReleaseTwice,
      afterSaleTwice,
    }, null, 2));
  } finally {
    await cleanup();
    const cleanupCounts = productId
      ? await Promise.all([
        dbQuery<any>('SELECT COUNT(*) AS count FROM products WHERE id = ? AND sku = ?', [productId, sku]),
        dbQuery<any>('SELECT COUNT(*) AS count FROM inventory_transactions WHERE product_id = ?', [productId]),
      ])
      : [];
    console.log(JSON.stringify({
      cleanup: {
        products: Number(cleanupCounts[0]?.[0]?.count || 0),
        transactions: Number(cleanupCounts[1]?.[0]?.count || 0),
      },
    }, null, 2));
    process.exit(0);
  }
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
