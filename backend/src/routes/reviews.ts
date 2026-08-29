import { Router } from 'express';
import { PoolConnection } from 'mysql2/promise';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected, withDbTransaction } from '../lib/db';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import { rateLimit } from '../middleware/rateLimit';
import { insertAdminAuditLog } from '../lib/adminAudit';
import { recalculateProductReviewAggregate } from '../lib/reviewAggregates';

const router = Router();

const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const;
type ReviewStatus = typeof REVIEW_STATUSES[number];

const reviewCreateLimiter = rateLimit('review-create', {
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => `${req.ip}:${(req as AuthRequest).user?.id || 'anonymous'}`,
  message: 'Too many review attempts. Please wait before trying again.',
});

const cleanPlainText = (value: unknown, max: number) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const toPositiveId = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

const publicName = (name: string, email: string) => {
  const cleaned = cleanPlainText(name, 80);
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
    return parts[0];
  }
  const local = cleanPlainText(String(email || '').split('@')[0], 30);
  return local || 'BrajMart customer';
};

const ensureReviewsTable = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      title VARCHAR(120) NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      status ENUM('PENDING','APPROVED','REJECTED','HIDDEN') NOT NULL DEFAULT 'PENDING',
      is_verified_purchase TINYINT(1) NOT NULL DEFAULT 1,
      helpful_count INT NOT NULL DEFAULT 0,
      report_count INT NOT NULL DEFAULT 0,
      approved_at DATETIME NULL,
      rejected_at DATETIME NULL,
      hidden_at DATETIME NULL,
      rejection_reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reviews_user_product_order (user_id, product_id, order_id),
      KEY idx_reviews_product_status_created (product_id, status, created_at),
      KEY idx_reviews_user_product (user_id, product_id),
      KEY idx_reviews_status_created (status, created_at),
      KEY idx_reviews_order (order_id),
      CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
      CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const mapPublicReview = (row: any) => ({
  id: String(row.id),
  productId: String(row.product_id),
  rating: Number(row.rating),
  title: row.title || '',
  body: row.body || '',
  status: row.status,
  isVerifiedPurchase: boolFromDb(row.is_verified_purchase),
  customerName: publicName(row.customer_name || row.user_name || '', row.customer_email || row.user_email || ''),
  createdAt: toIsoString(row.created_at),
});

const mapAdminReview = (row: any) => ({
  ...mapPublicReview(row),
  userId: String(row.user_id),
  orderId: String(row.order_id),
  productName: row.product_name || '',
  productSlug: row.product_slug || '',
  productImage: row.product_image || '',
  customerEmail: row.customer_email || row.user_email || '',
  helpfulCount: Number(row.helpful_count || 0),
  reportCount: Number(row.report_count || 0),
  approvedAt: toIsoString(row.approved_at),
  rejectedAt: toIsoString(row.rejected_at),
  hiddenAt: toIsoString(row.hidden_at),
  rejectionReason: row.rejection_reason || '',
  updatedAt: toIsoString(row.updated_at),
});

const buildSummary = async (productId: number) => {
  const rows = await dbQuery<any>(
    `SELECT
       COUNT(*) AS review_count,
       ROUND(AVG(rating), 1) AS average_rating,
       SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5,
       SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
       SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
       SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
       SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1
     FROM reviews
     WHERE product_id = ? AND status = 'APPROVED'`,
    [productId]
  );
  const row = rows[0] || {};
  const count = Number(row.review_count || 0);
  return {
    averageRating: count > 0 ? Number(row.average_rating || 0) : 0,
    reviewCount: count,
    distribution: {
      5: Number(row.rating_5 || 0),
      4: Number(row.rating_4 || 0),
      3: Number(row.rating_3 || 0),
      2: Number(row.rating_2 || 0),
      1: Number(row.rating_1 || 0),
    },
  };
};

const itemMatchesProduct = (items: any[], productId: number) =>
  items.some((item) => String(item?.productId || item?.id || item?._id || '') === String(productId));

const findEligibleOrder = async (user: NonNullable<AuthRequest['user']>, productId: number, requestedOrderId?: number | null) => {
  const userId = toPositiveId(user.id);
  if (!userId) return { ok: false as const, message: 'Please sign in again before reviewing.' };

  const userRows = await dbQuery<any>('SELECT id, email, status FROM users WHERE id = ? LIMIT 1', [userId]);
  const userRow = userRows[0];
  if (!userRow) return { ok: false as const, message: 'User account not found.' };
  if (String(userRow.status || '').toLowerCase() === 'blocked') return { ok: false as const, message: 'This account cannot submit reviews.' };

  const productRows = await dbQuery<any>('SELECT id, archived_at FROM products WHERE id = ? LIMIT 1', [productId]);
  const product = productRows[0];
  if (!product) return { ok: false as const, message: 'Product not found.' };
  if (product.archived_at) return { ok: false as const, message: 'Archived products cannot receive new reviews.' };

  const params: any[] = [userId, String(userRow.email || user.email || '').toLowerCase()];
  let orderIdSql = '';
  if (requestedOrderId) {
    orderIdSql = 'AND o.id = ?';
    params.push(requestedOrderId);
  }
  const orders = await dbQuery<any>(
    `SELECT o.id, o.items, o.status, o.customer_email
     FROM orders o
     WHERE (o.user_id = ? OR LOWER(o.customer_email) = ?)
       AND o.status = 'delivered'
       AND ${merchantOrderWhereSql('o')}
       ${orderIdSql}
     ORDER BY o.updated_at DESC, o.id DESC
     LIMIT 25`,
    params
  );

  const eligible = orders.find((order) => itemMatchesProduct(parseJson(order.items, []), productId));
  if (!eligible) return { ok: false as const, message: 'Only delivered purchases can be reviewed.' };

  const duplicateRows = await dbQuery<any>(
    'SELECT id, status FROM reviews WHERE product_id = ? AND user_id = ? AND order_id = ? LIMIT 1',
    [productId, userId, eligible.id]
  );
  if (duplicateRows[0]) {
    return { ok: false as const, message: 'You have already submitted a review for this purchase.', existingReviewId: String(duplicateRows[0].id), status: duplicateRows[0].status };
  }

  return { ok: true as const, userId, orderId: Number(eligible.id) };
};

router.get('/products/:productId', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureReviewsTable();
    const productId = toPositiveId(req.params.productId);
    if (!productId) return res.status(400).json({ message: 'Invalid product' });
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 5)));
    const sort = String(req.query.sort || 'recent');
    const orderBy = sort === 'highest'
      ? 'r.rating DESC, r.created_at DESC'
      : sort === 'lowest'
      ? 'r.rating ASC, r.created_at DESC'
      : 'r.created_at DESC';

    const summary = await buildSummary(productId);
    const offset = (page - 1) * limit;
    const reviews = await dbQuery<any>(
      `SELECT r.*, u.name AS user_name, u.email AS user_email
       FROM reviews r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? AND r.status = 'APPROVED'
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [productId, limit, offset]
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ summary, page, limit, totalPages: Math.max(1, Math.ceil(summary.reviewCount / limit)), reviews: reviews.map(mapPublicReview) });
  } catch {
    res.status(500).json({ message: 'Failed to load reviews' });
  }
});

router.get('/eligibility/:productId', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureReviewsTable();
    const productId = toPositiveId(req.params.productId);
    if (!productId || !req.user) return res.status(400).json({ message: 'Invalid product' });
    const result = await findEligibleOrder(req.user, productId, toPositiveId(req.query.orderId));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(result.ok ? { canReview: true, orderId: String(result.orderId) } : { canReview: false, reason: result.message, existingReviewId: result.existingReviewId, status: result.status });
  } catch {
    res.status(500).json({ message: 'Failed to check review eligibility' });
  }
});

router.post('/', auth, reviewCreateLimiter, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureReviewsTable();
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const productId = toPositiveId(req.body?.productId);
    const orderId = toPositiveId(req.body?.orderId);
    const rating = Number(req.body?.rating);
    const title = cleanPlainText(req.body?.title, 120);
    const body = cleanPlainText(req.body?.body, 2000);
    if (!productId) return res.status(400).json({ message: 'Choose a valid product.' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    if (body.length < 10) return res.status(400).json({ message: 'Review must be at least 10 characters.' });
    if (body.length > 2000) return res.status(400).json({ message: 'Review is too long.' });

    const eligibility = await findEligibleOrder(req.user, productId, orderId);
    if (!eligibility.ok) return res.status(403).json({ message: eligibility.message });

    const result: any = await dbExecute(
      `INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, status, is_verified_purchase)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 1)`,
      [productId, eligibility.userId, eligibility.orderId, rating, title, body]
    );
    const rows = await dbQuery<any>('SELECT * FROM reviews WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ message: 'Your review has been submitted and is awaiting moderation.', review: mapPublicReview(rows[0]) });
  } catch (err: any) {
    if (String(err?.code || '') === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'You have already submitted a review for this purchase.' });
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureReviewsTable();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const status = cleanPlainText(req.query.status, 20).toUpperCase();
    const rating = Number(req.query.rating || 0);
    const q = `%${cleanPlainText(req.query.q, 100).toLowerCase()}%`;
    const where: string[] = [];
    const params: any[] = [];
    if (REVIEW_STATUSES.includes(status as ReviewStatus)) {
      where.push('r.status = ?');
      params.push(status);
    }
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      where.push('r.rating = ?');
      params.push(rating);
    }
    if (q !== '%%') {
      where.push('(LOWER(r.title) LIKE ? OR LOWER(r.body) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?)');
      params.push(q, q, q, q, q);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await dbQuery<any>(
      `SELECT COUNT(*) AS count
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.count || 0);
    const offset = (page - 1) * limit;
    const rows = await dbQuery<any>(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug, p.image AS product_image, u.name AS user_name, u.email AS user_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), items: rows.map(mapAdminReview) });
  } catch {
    res.status(500).json({ message: 'Failed to load review moderation queue' });
  }
});

router.patch('/admin/:id/status', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureReviewsTable();
    const id = toPositiveId(req.params.id);
    const status = cleanPlainText(req.body?.status, 20).toUpperCase() as ReviewStatus;
    const reason = cleanPlainText(req.body?.reason || `Review marked ${status.toLowerCase()}`, 255);
    if (!id) return res.status(400).json({ message: 'Invalid review' });
    if (!REVIEW_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid review status' });
    if ((status === 'REJECTED' || status === 'HIDDEN') && !reason) return res.status(400).json({ message: 'Reason is required.' });

    let mapped: any = null;
    await withDbTransaction(async (connection: PoolConnection) => {
      const [beforeRows] = await connection.execute('SELECT * FROM reviews WHERE id = ? FOR UPDATE', [id]);
      const before = (beforeRows as any[])[0];
      if (!before) throw new Error('Review not found');
      const updates = {
        APPROVED: 'approved_at = COALESCE(approved_at, NOW()), rejected_at = NULL, hidden_at = NULL, rejection_reason = NULL',
        PENDING: 'approved_at = NULL, rejected_at = NULL, hidden_at = NULL, rejection_reason = NULL',
        REJECTED: 'rejected_at = NOW(), approved_at = NULL, hidden_at = NULL, rejection_reason = ?',
        HIDDEN: 'hidden_at = NOW(), approved_at = NULL, rejection_reason = ?',
      };
      const params = status === 'REJECTED' || status === 'HIDDEN'
        ? [status, reason, id]
        : [status, id];
      await connection.execute(
        `UPDATE reviews SET status = ?, ${updates[status]}, updated_at = NOW() WHERE id = ?`,
        params
      );
      await recalculateProductReviewAggregate(connection, before.product_id);
      const [afterRows] = await connection.execute('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id]);
      const after = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: status === 'APPROVED' ? 'REVIEW_APPROVE' : status === 'REJECTED' ? 'REVIEW_REJECT' : status === 'HIDDEN' ? 'REVIEW_HIDE' : 'REVIEW_RESTORE',
        entityType: 'review',
        entityId: id,
        before,
        after,
        reason,
        metadata: { productId: String(before.product_id), orderId: String(before.order_id) },
      });
      mapped = after;
    });
    res.json({ ok: true, review: mapAdminReview(mapped) });
  } catch (err: any) {
    const message = err?.message || 'Failed to update review';
    res.status(message === 'Review not found' ? 404 : 400).json({ message });
  }
});

export default router;
