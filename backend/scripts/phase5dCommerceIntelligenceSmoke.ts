import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
const stamp = Date.now();
const adminEmail = `phase5d-admin-${stamp}@example.invalid`;
const userEmail = `phase5d-user-${stamp}@example.invalid`;
const skuPrefix = `PHASE5D_${stamp}`;

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

const token = (id: number, email: string, role: 'admin' | 'user' = 'user') =>
  jwt.sign({ id: String(id), email, role }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '10m' });

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

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const createUser = async (email: string, role: 'admin' | 'user') => {
  const password = await bcrypt.hash('phase5d-test-password', 10);
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO users (name, email, password, role, status, is_verified) VALUES (?, ?, ?, ?, ?, 1)',
    [`Phase 5D ${role}`, email, password, role, 'active'],
  );
  return Number(result.insertId);
};

const createProduct = async (name: string, price: number, opts: { archived?: boolean; stock?: number } = {}) => {
  const slug = `${name}-${skuPrefix}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO products
      (name, slug, sku, price, original_price, image, category, in_stock, stock_quantity, reserved_quantity, low_stock_threshold, description, archived_at, archived_by, archive_reason)
     VALUES (?, ?, ?, ?, ?, '/placeholder.svg', 'Books', 1, ?, 0, 1, ?, ${opts.archived ? 'NOW()' : 'NULL'}, ?, ?)`,
    [
      name,
      slug,
      `${skuPrefix}_${name}`.slice(0, 110),
      price,
      price + 20,
      opts.stock ?? 10,
      'Phase 5D isolated recommendation product',
      opts.archived ? adminEmail : null,
      opts.archived ? 'Phase 5D archived exclusion' : null,
    ],
  );
  return { id: Number(result.insertId), slug };
};

const createOrder = async (userId: number, items: Array<{ productId: number; name: string; price: number }>, status: string, paymentStatus: 'paid' | 'failed') => {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO orders
      (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, estimated_delivery, status_history)
     VALUES (?, ?, ?, 0, 0, 0, 0, ?, ?, 'Phase 5D Customer', ?, '{}', '{}', 'Razorpay', NOW(), ?)`,
    [
      userId,
      JSON.stringify(items.map((item) => ({ productId: String(item.productId), name: item.name, price: item.price, quantity: 1 }))),
      total,
      total,
      status,
      userEmail,
      JSON.stringify([{ status, date: new Date().toISOString(), note: 'Phase 5D smoke order' }]),
    ],
  );
  const orderId = Number(result.insertId);
  await pool.execute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?)',
    [`phase5d_${orderId}_${stamp}`, paymentStatus, orderId, total, 'Razorpay', `phase5d_payment_${orderId}_${stamp}`],
  );
  return orderId;
};

const count = async (sql: string, params: unknown[] = []) => {
  const [rows] = await pool.query<any[]>(sql, params);
  return Number(rows[0]?.count || 0);
};

const cleanup = async () => {
  const [bundleRows] = await pool.query<any[]>('SELECT id FROM bundles WHERE slug LIKE ?', [`%${skuPrefix.toLowerCase()}%`]).catch(() => [[] as any[]]);
  const bundleIds = bundleRows.map((row) => Number(row.id)).filter(Boolean);
  if (bundleIds.length) {
    await pool.query(`DELETE FROM bundle_products WHERE bundle_id IN (${bundleIds.map(() => '?').join(',')})`, bundleIds).catch(() => {});
    await pool.query(`DELETE FROM bundles WHERE id IN (${bundleIds.map(() => '?').join(',')})`, bundleIds).catch(() => {});
  }
  await pool.execute('DELETE FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]).catch(() => {});
  const [orderRows] = await pool.query<any[]>('SELECT id FROM orders WHERE customer_email = ?', [userEmail]).catch(() => [[] as any[]]);
  const orderIds = orderRows.map((row) => Number(row.id)).filter(Boolean);
  if (orderIds.length) {
    await pool.query(`DELETE FROM payment_status WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds).catch(() => {});
    await pool.query(`DELETE FROM payments WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds).catch(() => {});
    await pool.query(`DELETE FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`, orderIds).catch(() => {});
  }
  await pool.execute('DELETE FROM products WHERE sku LIKE ?', [`${skuPrefix}%`]).catch(() => {});
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [adminEmail, userEmail]).catch(() => {});
};

const main = async () => {
  let productA = { id: 0, slug: '' };
  let productB = { id: 0, slug: '' };
  let productC = { id: 0, slug: '' };
  let invalid = { id: 0, slug: '' };
  let archived = { id: 0, slug: '' };
  try {
    await cleanup();
    const adminId = await createUser(adminEmail, 'admin');
    const userId = await createUser(userEmail, 'user');
    const adminToken = token(adminId, adminEmail, 'admin');
    const userToken = token(userId, userEmail, 'user');

    productA = await createProduct('Anchor Book', 120);
    productB = await createProduct('Paired Book', 80);
    productC = await createProduct('Second Paired Book', 90);
    invalid = await createProduct('Invalid Price Book', 1);
    await pool.execute('UPDATE products SET price = 0 WHERE id = ?', [invalid.id]);
    archived = await createProduct('Archived Book', 70, { archived: true });

    await createOrder(userId, [
      { productId: productA.id, name: 'Anchor Book', price: 120 },
      { productId: productB.id, name: 'Paired Book', price: 80 },
    ], 'delivered', 'paid');
    await createOrder(userId, [
      { productId: productA.id, name: 'Anchor Book', price: 120 },
      { productId: productB.id, name: 'Paired Book', price: 80 },
      { productId: productC.id, name: 'Second Paired Book', price: 90 },
    ], 'confirmed', 'paid');
    await createOrder(userId, [
      { productId: productA.id, name: 'Anchor Book', price: 120 },
      { productId: archived.id, name: 'Archived Book', price: 70 },
    ], 'delivered', 'paid');
    await createOrder(userId, [
      { productId: productA.id, name: 'Anchor Book', price: 120 },
      { productId: invalid.id, name: 'Invalid Price Book', price: 1 },
    ], 'confirmed', 'failed');
    await createOrder(userId, [
      { productId: productA.id, name: 'Anchor Book', price: 120 },
      { productId: productC.id, name: 'Second Paired Book', price: 90 },
    ], 'cancelled', 'paid');

    const unauth = await request('/api/bundles/admin');
    assert(unauth.status === 401, 'Admin bundles must require auth');
    const userDenied = await request('/api/bundles/admin', { headers: { Authorization: `Bearer ${userToken}` } });
    assert(userDenied.status === 403, 'Admin bundles must require admin role');

    const duplicate = await request('/api/bundles/admin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Duplicate ${skuPrefix}`, productIds: [productA.id, productA.id] }),
    });
    assert(duplicate.status === 400, 'Duplicate bundle products must be rejected');

    const archivedBundle = await request('/api/bundles/admin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Archived ${skuPrefix}`, productIds: [productA.id, archived.id] }),
    });
    assert(archivedBundle.status === 400, 'Archived bundle product must be rejected');

    const created = await request('/api/bundles/admin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Phase 5D Bundle ${skuPrefix}`,
        slug: `phase-5d-bundle-${skuPrefix}`,
        description: 'Smoke-test curated set',
        displayLocation: 'home',
        isActive: true,
        productIds: [productA.id, productB.id, productC.id],
      }),
    });
    assert(created.status === 201 && created.json?.bundle?.id, 'Bundle creation failed');
    const bundleId = String(created.json.bundle.id);

    const updated = await request(`/api/bundles/admin/${bundleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Phase 5D Bundle Updated ${skuPrefix}`, productIds: [productA.id, productB.id] }),
    });
    assert(updated.status === 200, 'Bundle update failed');
    const inactive = await request(`/api/bundles/admin/${bundleId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(inactive.status === 200 && inactive.json?.bundle?.isActive === false, 'Bundle deactivation failed');
    const active = await request(`/api/bundles/admin/${bundleId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: true }),
    });
    assert(active.status === 200 && active.json?.bundle?.isActive === true, 'Bundle activation failed');

    const recs = await request(`/api/recommendations/product/${productA.id}?limit=5`);
    assert(recs.status === 200, `Recommendation endpoint failed: status=${recs.status} body=${JSON.stringify(recs.json)}`);
    const recProducts = (recs.json?.recommendations || []).map((item: any) => String(item?.product?.id));
    assert(recProducts.includes(String(productB.id)), 'Real co-occurrence product missing');
    assert(!recProducts.includes(String(productA.id)), 'Self recommendation returned');
    assert(!recProducts.includes(String(archived.id)), 'Archived product returned');
    assert(!recProducts.includes(String(invalid.id)), 'Invalid price product returned');
    assert((recs.json?.recommendations || []).length <= 5, 'Recommendation limit not respected');

    const cartRecs = await request('/api/recommendations/cart', {
      method: 'POST',
      body: JSON.stringify({ productIds: [productA.id], limit: 3 }),
    });
    assert(cartRecs.status === 200 && (cartRecs.json?.recommendations || []).length <= 3, 'Cart recommendation endpoint failed');

    assert(await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]) >= 4, 'Bundle audit logs missing');

    await cleanup();
    const testProducts = await count('SELECT COUNT(*) AS count FROM products WHERE sku LIKE ?', [`${skuPrefix}%`]);
    const testOrders = await count('SELECT COUNT(*) AS count FROM orders WHERE customer_email = ?', [userEmail]);
    const testBundles = await count('SELECT COUNT(*) AS count FROM bundles WHERE slug LIKE ?', [`%${skuPrefix.toLowerCase()}%`]);
    const testAuditLogs = await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]);
    const testUsers = await count('SELECT COUNT(*) AS count FROM users WHERE email IN (?, ?)', [adminEmail, userEmail]);
    assert(testProducts === 0, `Cleanup failed: testProducts=${testProducts}`);
    assert(testOrders === 0, `Cleanup failed: testOrders=${testOrders}`);
    assert(testBundles === 0, `Cleanup failed: testBundles=${testBundles}`);
    assert(testAuditLogs === 0, `Cleanup failed: testAuditLogs=${testAuditLogs}`);
    assert(testUsers === 0, `Cleanup failed: testUsers=${testUsers}`);

    console.log('PHASE 5D COMMERCE INTELLIGENCE SMOKE: PASS');
    console.log(JSON.stringify({ testProducts, testOrders, testBundles, testAuditLogs, testUsers }, null, 2));
  } catch (err) {
    await cleanup();
    console.error('PHASE 5D COMMERCE INTELLIGENCE SMOKE: FAIL');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
