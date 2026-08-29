import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env' });

const sku = `PHASE42_FINAL_UNIT_${Date.now()}`;
const orderIds: number[] = [];
let productId = 0;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 4,
  timezone: 'Z',
});

const reserve = async (orderId: number) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT id, name, stock_quantity, reserved_quantity FROM products WHERE id = ? FOR UPDATE',
      [productId],
    );
    const row = (rows as Array<{ stock_quantity: number; reserved_quantity: number; name: string }>)[0];
    const stock = Number(row.stock_quantity || 0);
    const reserved = Number(row.reserved_quantity || 0);
    const available = stock - reserved;
    if (available < 1) throw new Error(`Only ${Math.max(0, available)} available`);

    const nextReserved = reserved + 1;
    await connection.execute(
      'UPDATE products SET reserved_quantity = ?, in_stock = IF(stock_quantity - ? > 0, 1, 0), updated_at = NOW() WHERE id = ?',
      [nextReserved, nextReserved, productId],
    );
    await connection.execute(
      `INSERT INTO inventory_transactions
        (product_id, order_id, type, quantity, previous_quantity, new_quantity, previous_reserved, new_reserved, reason)
       VALUES (?, ?, 'RESERVE', 1, ?, ?, ?, ?, 'Phase 4.2 final unit concurrency test')`,
      [productId, orderId, stock, stock, reserved, nextReserved],
    );
    await connection.commit();
    return { ok: true, orderId };
  } catch (err) {
    await connection.rollback().catch(() => {});
    return { ok: false, orderId, message: err instanceof Error ? err.message : 'Reservation failed' };
  } finally {
    connection.release();
  }
};

const cleanup = async () => {
  if (!productId) return;
  await pool.execute('DELETE FROM inventory_transactions WHERE product_id = ?', [productId]).catch(() => {});
  if (orderIds.length) {
    await pool.query(`DELETE FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds).catch(() => {});
  }
  await pool.execute('DELETE FROM products WHERE id = ? AND sku = ?', [productId, sku]).catch(() => {});
};

const readCleanupCounts = async () => {
  if (!productId) return null;
  const [products] = await pool.execute('SELECT COUNT(*) AS count FROM products WHERE id = ? AND sku = ?', [productId, sku]);
  const [orders] = orderIds.length
    ? await pool.query(`SELECT COUNT(*) AS count FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds)
    : [[]];
  const [transactions] = await pool.execute('SELECT COUNT(*) AS count FROM inventory_transactions WHERE product_id = ?', [productId]);
  return {
    products: Number((products as Array<{ count: number }>)[0]?.count || 0),
    orders: Number((orders as Array<{ count: number }>)[0]?.count || 0),
    transactions: Number((transactions as Array<{ count: number }>)[0]?.count || 0),
  };
};

const run = async () => {
  try {
    const [productResult] = await pool.execute(
      `INSERT INTO products
        (name, slug, sku, price, original_price, image, category, in_stock, stock_quantity, reserved_quantity, low_stock_threshold, description)
       VALUES (?, ?, ?, 99, 129, '/placeholder.svg', 'Phase QA', 1, 1, 0, 1, 'Phase 4.2 isolated test product')`,
      ['Phase 4.2 Final Unit Test Product', sku.toLowerCase(), sku],
    );
    productId = Number((productResult as { insertId: number }).insertId);

    for (let i = 0; i < 2; i += 1) {
      const [orderResult] = await pool.execute(
        `INSERT INTO orders
          (items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, estimated_delivery, status_history)
         VALUES (?, 99, 0, 0, 0, 0, 99, 'processing', 'Phase QA', 'phase42@example.invalid', '{}', '{}', 'Razorpay', NOW(), ?)`,
        [
          JSON.stringify([{ productId: String(productId), name: 'Phase 4.2 Final Unit Test Product', quantity: 1, price: 99 }]),
          JSON.stringify([{ status: 'processing', date: new Date().toISOString(), note: 'Phase 4.2 test order' }]),
        ],
      );
      orderIds.push(Number((orderResult as { insertId: number }).insertId));
    }

    const results = await Promise.all(orderIds.map((id) => reserve(id)));
    const [stateRows] = await pool.query(
      'SELECT stock_quantity, reserved_quantity, stock_quantity - reserved_quantity AS available FROM products WHERE id = ?',
      [productId],
    );
    const [transactionRows] = await pool.query(
      'SELECT type, COUNT(*) AS count FROM inventory_transactions WHERE product_id = ? GROUP BY type',
      [productId],
    );

    console.log(JSON.stringify({ results, state: (stateRows as unknown[])[0], transactions: transactionRows }, null, 2));
  } finally {
    await cleanup();
    console.log(JSON.stringify({ cleanup: await readCleanupCounts() }, null, 2));
    await pool.end();
  }
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
