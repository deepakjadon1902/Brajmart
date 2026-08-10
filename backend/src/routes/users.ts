import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import bcrypt from 'bcryptjs';

const router = Router();

const mapUserRow = (row: any) => ({
  _id: String(row.id),
  name: row.name,
  email: row.email,
  phone: row.phone || '',
  role: row.role,
  status: row.status,
  googleId: row.google_id ?? null,
  avatar: row.avatar || '',
  isVerified: boolFromDb(row.is_verified),
  verificationToken: row.verification_token ?? null,
  verificationTokenExpires: toIsoString(row.verification_token_expires),
  addresses: parseJson(row.addresses, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapCustomerRow = (row: any) => ({
  _id: row.id,
  id: row.id,
  name: row.name || 'Customer',
  email: row.email || '',
  phone: row.phone || '',
  role: row.role || 'user',
  status: row.status || 'active',
  customerType: row.customer_type || 'registered',
  orders: Number(row.orders || 0),
  spent: Number(row.spent || 0),
  addresses: parseJson(row.addresses, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(`
      SELECT
        CAST(u.id AS CHAR) AS id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.addresses,
        u.created_at,
        u.updated_at,
        'registered' AS customer_type,
        COUNT(o.id) AS orders,
        COALESCE(SUM(o.total), 0) AS spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND ${merchantOrderWhereSql('o')}
      GROUP BY u.id

      UNION ALL

      SELECT
        CONCAT('guest:', LOWER(o.customer_email)) AS id,
        COALESCE(NULLIF(SUBSTRING_INDEX(GROUP_CONCAT(o.customer_name ORDER BY o.created_at DESC SEPARATOR '||'), '||', 1), ''), 'Guest Customer') AS name,
        LOWER(o.customer_email) AS email,
        COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(SUBSTRING_INDEX(GROUP_CONCAT(o.shipping_address ORDER BY o.created_at DESC SEPARATOR '||'), '||', 1), '$.mobile')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(SUBSTRING_INDEX(GROUP_CONCAT(o.billing_address ORDER BY o.created_at DESC SEPARATOR '||'), '||', 1), '$.mobile')), ''),
          ''
        ) AS phone,
        'user' AS role,
        'active' AS status,
        JSON_ARRAY(
          JSON_EXTRACT(SUBSTRING_INDEX(GROUP_CONCAT(o.shipping_address ORDER BY o.created_at DESC SEPARATOR '||'), '||', 1), '$')
        ) AS addresses,
        MIN(o.created_at) AS created_at,
        MAX(o.updated_at) AS updated_at,
        'guest' AS customer_type,
        COUNT(o.id) AS orders,
        COALESCE(SUM(o.total), 0) AS spent
      FROM orders o
      WHERE o.user_id IS NULL
        AND o.customer_email IS NOT NULL
        AND o.customer_email <> ''
        AND ${merchantOrderWhereSql('o')}
      GROUP BY LOWER(o.customer_email)
      ORDER BY updated_at DESC
    `);
    res.json(rows.map(mapCustomerRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const userIdRaw = req.user?.id;
    if (!userIdRaw) return res.status(401).json({ message: 'Unauthorized' });
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) return res.status(401).json({ message: 'Unauthorized' });

    const {
      fullName,
      email,
      mobile,
      address,
      city,
      state,
      pincode,
    } = req.body || {};

    const addresses = [
      {
        fullName: fullName || '',
        mobile: mobile || '',
        street: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || '',
        isDefault: true,
      },
    ];

    const currentRows = await dbQuery<any>('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!currentRows[0]) return res.status(404).json({ message: 'User not found' });
    const currentEmailRaw = String(currentRows[0].email || '').trim();
    const currentEmail = currentEmailRaw.toLowerCase();
    const nextEmailRaw = String(email || '').trim();
    const nextEmail = nextEmailRaw.toLowerCase();
    let finalEmailRaw = nextEmailRaw ? nextEmailRaw : currentEmailRaw;
    let emailConflict = false;

    if (nextEmailRaw && nextEmail !== currentEmail) {
      const exists = await dbQuery<any>(
        'SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1',
        [nextEmail, userId]
      );
      if (exists.length) {
        emailConflict = true;
        finalEmailRaw = currentEmailRaw;
      }
    }

    await dbExecute(
      'UPDATE users SET name = ?, email = ?, phone = ?, addresses = ?, updated_at = NOW() WHERE id = ?',
      [fullName || '', finalEmailRaw, mobile || '', JSON.stringify(addresses), userId]
    );

    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json({ ...mapUserRow(rows[0]), emailConflict });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me/password', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const userIdRaw = req.user?.id;
    if (!userIdRaw) return res.status(401).json({ message: 'Unauthorized' });
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) return res.status(401).json({ message: 'Unauthorized' });

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const rows = await dbQuery<any>('SELECT id, password FROM users WHERE id = ? LIMIT 1', [userId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'User not found' });

    const allowWithoutCurrent = !!req.user?.pwdReset;
    if (!allowWithoutCurrent) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
      const ok = await bcrypt.compare(currentPassword, row.password);
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await dbExecute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to update password' });
  }
});

router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(mapUserRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [req.body.role, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0] ? mapUserRow(rows[0]) : null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0] ? mapUserRow(rows[0]) : null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
