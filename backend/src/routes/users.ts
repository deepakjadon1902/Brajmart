import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

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

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(mapUserRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

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
    const currentEmailRaw = String(currentRows[0].email || '');
    const currentEmail = currentEmailRaw.trim().toLowerCase();
    const nextEmailRaw = String(email || '').trim();
    const nextEmail = nextEmailRaw.toLowerCase();

    if (nextEmail && nextEmail !== currentEmail) {
      const exists = await dbQuery<any>('SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1', [nextEmail, userId]);
      if (exists.length) return res.status(400).json({ message: 'Email already in use' });
    }

    await dbExecute(
      'UPDATE users SET name = ?, email = ?, phone = ?, addresses = ?, updated_at = NOW() WHERE id = ?',
      [fullName || '', nextEmailRaw || currentEmailRaw, mobile || '', JSON.stringify(addresses), userId]
    );

    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(mapUserRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
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
