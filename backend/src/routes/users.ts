import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
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
    if (!isDbConnected()) return res.json(memory.listUsers());
    const rows = await dbQuery<any>('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(mapUserRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const user = memory.listUsers().find((u) => u._id === req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json(user);
    }
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(mapUserRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const user = memory.listUsers().find((u) => u._id === req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.role = req.body.role;
      return res.json(user);
    }
    await dbExecute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [req.body.role, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0] ? mapUserRow(rows[0]) : null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const updated = memory.updateUserStatus(req.params.id, req.body.status);
      if (!updated) return res.status(404).json({ message: 'User not found' });
      return res.json(updated);
    }
    await dbExecute('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    res.json(rows[0] ? mapUserRow(rows[0]) : null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json({ message: 'User deleted' });
    }
    await dbExecute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
