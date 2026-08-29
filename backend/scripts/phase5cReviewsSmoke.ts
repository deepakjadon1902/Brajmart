import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
const stamp = Date.now();
const sku = `PHASE5C_REVIEW_${stamp}`;
const slug = sku.toLowerCase();
const adminEmail = 'phase5c-admin@example.invalid';
const userAEmail = 'phase5c-user-a@example.invalid';
const userBEmail = 'phase5c-user-b@example.invalid';
const blockedEmail = 'phase5c-blocked@example.invalid';

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

const count = async (sql: string, params: unknown[] = []) => {
  const [rows] = await pool.query<any[]>(sql, params);
  return Number(rows[0]?.count || 0);
};

const cleanup = async (ids: { users: number[]; productId?: number; orderIds: number[] }) => {
  if (ids.productId) await pool.execute('DELETE FROM reviews WHERE product_id = ?', [ids.productId]).catch(() => {});
  await pool.execute('DELETE FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]).catch(() => {});
  if (ids.orderIds.length) {
    await pool.query(`DELETE FROM payment_status WHERE order_id IN (${ids.orderIds.map(() => '?').join(',')})`, ids.orderIds).catch(() => {});
    await pool.query(`DELETE FROM orders WHERE id IN (${ids.orderIds.map(() => '?').join(',')})`, ids.orderIds).catch(() => {});
  }
  if (ids.productId) await pool.execute('DELETE FROM products WHERE id = ? AND sku = ?', [ids.productId, sku]).catch(() => {});
  if (ids.users.length) await pool.query(`DELETE FROM users WHERE id IN (${ids.users.map(() => '?').join(',')})`, ids.users).catch(() => {});
  await pool.query('DELETE FROM users WHERE email IN (?, ?, ?, ?)', [adminEmail, userAEmail, userBEmail, blockedEmail]).catch(() => {});
};

const createUser = async (email: string, role: 'admin' | 'user', status = 'active') => {
  const password = await bcrypt.hash('phase5c-test-password', 10);
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    'INSERT INTO users (name, email, password, role, status, is_verified) VALUES (?, ?, ?, ?, ?, 1)',
    [`Phase 5C ${role}`, email, password, role, status],
  );
  return Number(result.insertId);
};

const createDeliveredOrder = async (userId: number, email: string, productId: number) => {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO orders
      (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, estimated_delivery, status_history)
     VALUES (?, ?, 99, 0, 0, 0, 0, 99, 'delivered', 'Phase 5C Customer', ?, '{}', '{}', 'Razorpay', NOW(), ?)`,
    [
      userId,
      JSON.stringify([{ productId: String(productId), slug, name: 'Phase 5C Review Product', quantity: 1, price: 99 }]),
      email,
      JSON.stringify([{ status: 'delivered', date: new Date().toISOString(), note: 'Phase 5C review smoke' }]),
    ],
  );
  const orderId = Number(result.insertId);
  await pool.execute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, 99, ?, ?)',
    [`phase5c_status_${orderId}_${stamp}`, 'paid', orderId, 'Razorpay', `phase5c_payment_${orderId}_${stamp}`],
  );
  return orderId;
};

const main = async () => {
  const ids: { users: number[]; productId?: number; orderIds: number[] } = { users: [], orderIds: [] };
  try {
    await cleanup(ids);
    const adminId = await createUser(adminEmail, 'admin');
    const userAId = await createUser(userAEmail, 'user');
    const userBId = await createUser(userBEmail, 'user');
    const blockedId = await createUser(blockedEmail, 'user', 'blocked');
    ids.users.push(adminId, userAId, userBId, blockedId);

    const [productResult] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO products
        (name, slug, sku, price, original_price, image, category, in_stock, stock_quantity, reserved_quantity, low_stock_threshold, description)
       VALUES (?, ?, ?, 99, 129, '/placeholder.svg', 'Books', 1, 5, 0, 1, ?)`,
      ['Phase 5C Review Product', slug, sku, 'Safe isolated Phase 5C review product'],
    );
    ids.productId = Number(productResult.insertId);
    const orderA = await createDeliveredOrder(userAId, userAEmail, ids.productId);
    const orderB = await createDeliveredOrder(userBId, userBEmail, ids.productId);
    const orderA2 = await createDeliveredOrder(userAId, userAEmail, ids.productId);
    ids.orderIds.push(orderA, orderB, orderA2);

    const userAToken = token(userAId, userAEmail);
    const userBToken = token(userBId, userBEmail);
    const blockedToken = token(blockedId, blockedEmail);
    const adminToken = token(adminId, adminEmail, 'admin');

    const unauth = await request('/api/reviews', { method: 'POST', body: JSON.stringify({ productId: ids.productId, rating: 5, body: 'Great product.' }) });
    const noPurchase = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA, rating: 5, body: 'Trying another user order.' }),
    });
    const lowRating = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA, rating: 0, body: 'Invalid rating body.' }),
    });
    const highRating = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA, rating: 6, body: 'Invalid rating body.' }),
    });
    const valid = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA, rating: 5, title: 'Real review', body: 'A clean verified purchase review.' }),
    });
    const reviewId = String(valid.json?.review?.id || '');
    const duplicate = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA, rating: 4, body: 'Duplicate review attempt.' }),
    });
    const pendingPublic = await request(`/api/reviews/products/${ids.productId}`);
    const userAdminList = await request('/api/reviews/admin', { headers: { Authorization: `Bearer ${userAToken}` } });
    const userApprove = await request(`/api/reviews/admin/${reviewId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    const approve = await request(`/api/reviews/admin/${reviewId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'APPROVED', reason: 'Phase 5C approve smoke' }),
    });
    const approvedPublic = await request(`/api/reviews/products/${ids.productId}`);
    const productAfterApprove = await request(`/api/products/${slug}`);
    const reject = await request(`/api/reviews/admin/${reviewId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'REJECTED', reason: 'Phase 5C reject smoke' }),
    });
    const rejectedPublic = await request(`/api/reviews/products/${ids.productId}`);
    const productAfterReject = await request(`/api/products/${slug}`);
    await pool.execute('UPDATE products SET archived_at = NOW(), archived_by = ?, archive_reason = ? WHERE id = ?', [adminEmail, 'Phase 5C archive smoke', ids.productId]);
    const archivedReview = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderB, rating: 5, body: 'Cannot review archived product.' }),
    });
    await pool.execute('UPDATE products SET archived_at = NULL, archived_by = NULL, archive_reason = NULL WHERE id = ?', [ids.productId]);
    const blocked = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${blockedToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA2, rating: 5, body: 'Blocked user review attempt.' }),
    });
    const xss = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: ids.productId, orderId: orderA2, rating: 4, title: '<script>x</script>', body: '<script>alert(1)</script> This content should render as plain text.' }),
    });

    const result = {
      unauthenticatedBlocked: unauth.status === 401,
      crossUserOrderBlocked: noPurchase.status === 403,
      lowRatingRejected: lowRating.status === 400,
      highRatingRejected: highRating.status === 400,
      validReviewPending: valid.status === 201 && valid.json?.review?.status === 'PENDING' && valid.json?.review?.isVerifiedPurchase === true,
      duplicateBlocked: duplicate.status === 403 || duplicate.status === 409,
      pendingNotPublic: pendingPublic.status === 200 && pendingPublic.json?.summary?.reviewCount === 0,
      userCannotReadAdmin: userAdminList.status === 403,
      userCannotModerate: userApprove.status === 403,
      adminApprovePassed: approve.status === 200,
      approvedPublicVisible: approvedPublic.status === 200 && approvedPublic.json?.summary?.reviewCount === 1 && approvedPublic.json?.summary?.averageRating === 5,
      productAggregateApproved: productAfterApprove.status === 200 && Number(productAfterApprove.json?.rating) === 5 && Number(productAfterApprove.json?.reviewCount) === 1,
      adminRejectPassed: reject.status === 200,
      rejectedNotPublic: rejectedPublic.status === 200 && rejectedPublic.json?.summary?.reviewCount === 0,
      productAggregateRecalculated: productAfterReject.status === 200 && Number(productAfterReject.json?.reviewCount) === 0,
      archivedProductBlocked: archivedReview.status === 403,
      blockedUserBlocked: blocked.status === 403,
      xssStoredAsPending: xss.status === 201 && xss.json?.review?.status === 'PENDING',
      auditRowsCreated: await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]) >= 2,
    };

    console.log(JSON.stringify(result, null, 2));
    const allPassed = Object.values(result).every((value) => value === true);
    if (!allPassed) process.exitCode = 1;
  } finally {
    await cleanup(ids);
    const cleanupCounts = {
      users: await count('SELECT COUNT(*) AS count FROM users WHERE email IN (?, ?, ?, ?)', [adminEmail, userAEmail, userBEmail, blockedEmail]).catch(() => -1),
      products: await count('SELECT COUNT(*) AS count FROM products WHERE sku = ?', [sku]).catch(() => -1),
      orders: ids.orderIds.length ? await count(`SELECT COUNT(*) AS count FROM orders WHERE id IN (${ids.orderIds.map(() => '?').join(',')})`, ids.orderIds).catch(() => -1) : 0,
      reviews: ids.productId ? await count('SELECT COUNT(*) AS count FROM reviews WHERE product_id = ?', [ids.productId]).catch(() => -1) : 0,
      auditLogs: await count('SELECT COUNT(*) AS count FROM admin_audit_logs WHERE admin_email = ?', [adminEmail]).catch(() => -1),
    };
    console.log(JSON.stringify({ cleanup: cleanupCounts }, null, 2));
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
