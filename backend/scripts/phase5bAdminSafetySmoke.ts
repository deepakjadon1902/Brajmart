import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
const stamp = Date.now();
const sku = `PHASE5B_SAFE_${stamp}`;
const slug = sku.toLowerCase();
const adminEmail = 'phase5b-admin@example.invalid';
const userEmail = 'phase5b-user@example.invalid';

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

const token = (role: 'admin' | 'user') =>
  jwt.sign(
    { id: `phase5b-${role}`, email: role === 'admin' ? adminEmail : userEmail, role },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '10m' },
  );

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

const cleanup = async (ids: { productId?: number; categoryId?: number; orderId?: number; blogId?: number; couponId?: number }) => {
  if (ids.productId) await pool.execute('DELETE FROM inventory_transactions WHERE product_id = ?', [ids.productId]).catch(() => {});
  if (ids.orderId) await pool.execute('DELETE FROM payment_status WHERE order_id = ?', [ids.orderId]).catch(() => {});
  if (ids.orderId) await pool.execute('DELETE FROM orders WHERE id = ?', [ids.orderId]).catch(() => {});
  if (ids.productId) await pool.execute('DELETE FROM products WHERE id = ? AND sku = ?', [ids.productId, sku]).catch(() => {});
  if (ids.categoryId) await pool.execute('DELETE FROM categories WHERE id = ? AND name = ?', [ids.categoryId, `Phase 5B Category ${stamp}`]).catch(() => {});
  if (ids.blogId) await pool.execute('DELETE FROM blogs WHERE id = ? AND slug = ?', [ids.blogId, slug]).catch(() => {});
  if (ids.couponId) await pool.execute('DELETE FROM coupons WHERE id = ? AND code = ?', [ids.couponId, sku]).catch(() => {});
  await pool.execute('DELETE FROM admin_audit_logs WHERE admin_email IN (?, ?)', [adminEmail, userEmail]).catch(() => {});
};

const count = async (sql: string, params: unknown[] = []) => {
  const [rows] = await pool.query<any[]>(sql, params);
  return Number(rows[0]?.count || 0);
};

const main = async () => {
  const ids: { productId?: number; categoryId?: number; orderId?: number; blogId?: number; couponId?: number } = {};
  try {
    await cleanup(ids);
    const [categoryResult] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO categories (name, icon, color, product_count) VALUES (?, ?, ?, 0)',
      [`Phase 5B Category ${stamp}`, '/placeholder.svg', '#92400e'],
    );
    ids.categoryId = Number(categoryResult.insertId);

    const [productResult] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO products
        (name, slug, sku, price, original_price, image, category, category_id, in_stock, stock_quantity, reserved_quantity, low_stock_threshold, description)
       VALUES (?, ?, ?, 99, 129, '/placeholder.svg', ?, ?, 1, 5, 0, 1, ?)`,
      ['Phase 5B Safe Product', slug, sku, `Phase 5B Category ${stamp}`, ids.categoryId, 'Phase 5B isolated product'],
    );
    ids.productId = Number(productResult.insertId);

    const [orderResult] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO orders
        (items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, estimated_delivery, status_history)
       VALUES (?, 99, 0, 0, 0, 0, 99, 'processing', 'Phase 5B', 'phase5b-order@example.invalid', '{}', '{}', 'Razorpay', NOW(), ?)`,
      [
        JSON.stringify([{ productId: String(ids.productId), slug, name: 'Phase 5B Safe Product', quantity: 1, price: 99 }]),
        JSON.stringify([{ status: 'processing', date: new Date().toISOString(), note: 'Phase 5B safety smoke' }]),
      ],
    );
    ids.orderId = Number(orderResult.insertId);
    await pool.execute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, 99, ?, ?)',
      [`phase5b_status_${stamp}`, 'paid', ids.orderId, 'Razorpay', `phase5b_payment_${stamp}`],
    );

    const unauthorized = await request(`/api/products/${ids.productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token('user')}` },
      body: JSON.stringify({ reason: 'phase5b unauthorized check' }),
    });

    const archiveProduct = await request(`/api/products/${ids.productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ reason: 'Phase 5B archive smoke' }),
    });

    const publicDetailArchived = await request(`/api/products/${slug}`);
    const cartValidation = await request('/api/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: String(ids.productId), quantity: 1, price: 99 }] }),
    });
    const restoreProduct = await request(`/api/products/${ids.productId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ reason: 'Phase 5B restore smoke' }),
    });
    const publicDetailRestored = await request(`/api/products/${slug}`);

    const orderStatus = await request(`/api/orders/${ids.orderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token('admin')}` },
      body: JSON.stringify({ status: 'shipped', note: 'Phase 5B audit smoke', trackingId: `PHASE5BTRACK${stamp}` }),
    });
    const tracking = await request(`/api/orders/track/${ids.orderId}`);
    const auditAdmin = await request('/api/admin/audit-logs?q=phase5b', {
      headers: { Authorization: `Bearer ${token('admin')}` },
    });
    const auditUser = await request('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${token('user')}` },
    });

    const [productRows] = await pool.query<any[]>('SELECT archived_at, archived_by, archive_reason FROM products WHERE id = ?', [ids.productId]);
    const auditCount = await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]);
    const historicalOrderCount = await count('SELECT COUNT(*) AS count FROM orders WHERE id = ?', [ids.orderId]);

    const result = {
      unauthorizedBlocked: unauthorized.status === 403,
      productArchivePassed: archiveProduct.status === 200 && Boolean(archiveProduct.json?.product?.archivedAt),
      publicDetailHiddenPassed: publicDetailArchived.status === 404,
      cartArchivedProtectionPassed: cartValidation.status === 200 && Array.isArray(cartValidation.json?.unavailableItems) && cartValidation.json.unavailableItems.length >= 1,
      productRestorePassed: restoreProduct.status === 200 && !restoreProduct.json?.product?.archivedAt,
      publicDetailRestoredPassed: publicDetailRestored.status === 200 && String(publicDetailRestored.json?.sku || '') === sku,
      orderAuditChangePassed: orderStatus.status === 200 && orderStatus.json?.trackingId === `PHASE5BTRACK${stamp}`,
      trackingPrivacyPassed: tracking.status === 200 && !JSON.stringify(tracking.json).includes('phase5b-order@example.invalid'),
      adminAuditReadablePassed: auditAdmin.status === 200 && Array.isArray(auditAdmin.json?.items),
      userAuditBlockedPassed: auditUser.status === 403,
      auditRowsCreatedPassed: auditCount >= 3,
      historicalOrderPreservedPassed: historicalOrderCount >= 1,
      diagnostics: {
        archiveProductStatus: archiveProduct.status,
        publicDetailArchivedStatus: publicDetailArchived.status,
        cartValidationStatus: cartValidation.status,
        restoreProductStatus: restoreProduct.status,
        publicDetailRestoredStatus: publicDetailRestored.status,
        orderStatusStatus: orderStatus.status,
        orderStatusMessage: orderStatus.json?.message || '',
        trackingStatus: tracking.status,
        trackingMessage: tracking.json?.message || '',
        auditAdminStatus: auditAdmin.status,
        auditRows: auditCount,
      },
      productArchiveState: productRows[0] || null,
    };

    console.log(JSON.stringify(result, null, 2));
    const allPassed = Object.entries(result)
      .filter(([key]) => key.endsWith('Passed') || key.endsWith('Blocked'))
      .every(([, value]) => value === true);
    if (!allPassed) process.exitCode = 1;
  } finally {
    await cleanup(ids);
    const cleanupCounts = {
      products: await count('SELECT COUNT(*) AS count FROM products WHERE sku = ?', [sku]).catch(() => -1),
      categories: await count('SELECT COUNT(*) AS count FROM categories WHERE name = ?', [`Phase 5B Category ${stamp}`]).catch(() => -1),
      orders: ids.orderId ? await count('SELECT COUNT(*) AS count FROM orders WHERE id = ?', [ids.orderId]).catch(() => -1) : 0,
      auditLogs: await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email IN (?, ?)', [adminEmail, userEmail]).catch(() => -1),
      paymentStatus: ids.orderId ? await count('SELECT COUNT(*) AS count FROM payment_status WHERE order_id = ?', [ids.orderId]).catch(() => -1) : 0,
    };
    console.log(JSON.stringify({ cleanup: cleanupCounts }, null, 2));
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
