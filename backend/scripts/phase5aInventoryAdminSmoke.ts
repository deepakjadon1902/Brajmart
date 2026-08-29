import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
const stamp = Date.now();
const sku = `PHASE5A_INV_${stamp}`;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 4,
});

const token = (role: 'admin' | 'user') =>
  jwt.sign({ id: `phase5a-${role}`, email: `phase5a-${role}@example.invalid`, role }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '10m' });

const request = async (pathName: string, options: RequestInit = {}) => {
  const res = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const cleanup = async (productId?: number) => {
  if (productId) {
    await pool.execute('DELETE FROM inventory_transactions WHERE product_id = ?', [productId]).catch(() => {});
    await pool.execute('DELETE FROM products WHERE id = ? AND sku = ?', [productId, sku]).catch(() => {});
  }
  await pool.execute('DELETE FROM products WHERE sku = ?', [sku]).catch(() => {});
};

const main = async () => {
  let productId = 0;
  try {
    await cleanup();
    const [insertResult] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO products
        (name, slug, sku, price, original_price, image, category, in_stock, stock_quantity, reserved_quantity, low_stock_threshold, description)
       VALUES (?, ?, ?, 45, 60, ?, 'Books', 1, 10, 3, 4, ?)`,
      ['Phase 5A Inventory Smoke Product', sku.toLowerCase(), sku, '/placeholder.svg', 'Safe isolated inventory smoke product']
    );
    productId = Number(insertResult.insertId);

    const userAdjust = await request(`/api/inventory/products/${productId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('user')}` },
      body: JSON.stringify({ type: 'INCREASE', quantity: 1, reason: 'Manual correction' }),
    });

    const inc = await request(`/api/inventory/products/${productId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ type: 'INCREASE', quantity: 5, reason: 'Purchase received', note: 'phase5a' }),
    });
    const dec = await request(`/api/inventory/products/${productId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ type: 'DECREASE', quantity: 2, reason: 'Damaged stock', note: 'phase5a' }),
    });
    const blocked = await request(`/api/inventory/products/${productId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ type: 'SET', quantity: 2, reason: 'Manual correction', note: 'below reserved' }),
    });
    const set = await request(`/api/inventory/products/${productId}/adjust`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ type: 'SET', quantity: 12, reason: 'Warehouse correction', note: 'phase5a' }),
    });
    const history = await request(`/api/inventory/products/${productId}/history`, {
      headers: { Authorization: `Bearer ${token('admin')}` },
    });
    const audit = await request('/api/inventory/audit', {
      headers: { Authorization: `Bearer ${token('admin')}` },
    });

    const [productRows] = await pool.query<any[]>('SELECT stock_quantity, reserved_quantity FROM products WHERE id = ?', [productId]);
    const [transactionRows] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM inventory_transactions WHERE product_id = ?', [productId]);

    const result = {
      unauthorizedBlocked: userAdjust.status === 403,
      increasePassed: inc.status === 200 && inc.json?.product?.stockQuantity === 15,
      decreasePassed: dec.status === 200 && dec.json?.product?.stockQuantity === 13,
      reservedProtectionPassed: blocked.status === 400,
      setPassed: set.status === 200 && set.json?.product?.stockQuantity === 12,
      historyPassed: history.status === 200 && Array.isArray(history.json?.transactions) && history.json.transactions.length === 3,
      auditPassed: audit.status === 200 && typeof audit.json?.productsWithIssues === 'number',
      finalStock: productRows[0],
      transactionCount: Number(transactionRows[0]?.count || 0),
    };

    console.log(JSON.stringify(result, null, 2));

    const allPassed = Object.entries(result)
      .filter(([key]) => key.endsWith('Passed') || key.endsWith('Blocked'))
      .every(([, value]) => value === true);
    if (!allPassed || result.transactionCount !== 3) process.exitCode = 1;
  } finally {
    await cleanup(productId);
    const [products] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM products WHERE sku = ?', [sku]);
    const [transactions] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM inventory_transactions WHERE product_id = ?', [productId || 0]);
    console.log(JSON.stringify({ cleanup: { products: Number(products[0]?.count || 0), inventoryTransactions: Number(transactions[0]?.count || 0) } }));
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
