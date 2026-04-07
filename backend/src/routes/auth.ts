import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import bcrypt from 'bcryptjs';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const signToken = (user: { id: string; email: string; role?: string }) =>
  jwt.sign(user, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });


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

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    if (!isDbConnected()) {
      const exists = memory.findUserByEmail(email);
      if (exists) return res.status(400).json({ message: 'Email already registered' });
      const hash = await bcrypt.hash(password, 12);
      const user = memory.createUser({
        name,
        email,
        passwordHash: hash,
        role: 'user',
        isVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      });
      return res.status(201).json({
        token: signToken({ id: user._id, email, role: user.role }),
        user: { id: user._id, name, email, role: user.role },
      });
    }

    const existing = await dbQuery<any>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result: any = await dbExecute(
      'INSERT INTO users (name, email, password, phone, role, status, google_id, avatar, is_verified, verification_token, verification_token_expires, addresses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, passwordHash, '', 'user', 'active', null, '', 1, null, null, JSON.stringify([])]
    );

    const userId = String(result.insertId);
    res.status(201).json({
      token: signToken({ id: userId, email, role: 'user' }),
      user: { id: userId, name, email, role: 'user' },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isDbConnected()) {
      const user = memory.findUserByEmail(email);
      if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      return res.json({ token: signToken({ id: user._id, email, role: user.role }), user: { id: user._id, name: user.name, email, role: user.role } });
    }

    const rows = await dbQuery<any>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({ token: signToken({ id: String(row.id), email, role: row.role }), user: { id: String(row.id), name: row.name, email, role: row.role } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Admin login with env credentials
router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body;

  if (isDbConnected()) {
    try {
      const rows = await dbQuery<any>('SELECT * FROM admins WHERE email = ? AND status = ? LIMIT 1', [email, 'active']);
      const row = rows[0];
      if (!row || !(await bcrypt.compare(password, row.password))) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }
      await dbExecute('UPDATE admins SET last_login = NOW() WHERE id = ?', [row.id]);
      return res.json({
        token: signToken({ id: String(row.id), email: row.email, role: 'admin' }),
        user: { id: String(row.id), name: row.name, email: row.email, role: 'admin' },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || 'Admin login failed' });
    }
  }

  // Fallback to env-based admin for local/dev
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return res.status(500).json({ message: 'Admin credentials not configured' });
  if (email !== adminEmail || password !== adminPassword) return res.status(401).json({ message: 'Invalid admin credentials' });
  res.json({ token: signToken({ id: 'admin', email, role: 'admin' }), user: { id: 'admin', name: 'Admin', email, role: 'admin' } });
});

router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, avatar } = req.body;
    if (!email || !name || !googleId) return res.status(400).json({ message: 'Missing fields' });
    if (!isDbConnected()) {
      let user = memory.findUserByEmail(email);
      if (!user) {
        user = memory.createUser({
          name,
          email,
          passwordHash: await bcrypt.hash(googleId + (process.env.JWT_SECRET || 'secret'), 12),
          googleId,
          avatar,
          isVerified: true,
        } as any);
      } else if (!user.isVerified) {
        memory.updateUser(user._id, { isVerified: true, verificationToken: null, verificationTokenExpires: null });
      }
      return res.json({ token: signToken({ id: user._id, email, role: user.role }), user: { id: user._id, name: user.name, email, role: user.role } });
    }

    const rows = await dbQuery<any>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    let row = rows[0];
    if (!row) {
      const passwordHash = await bcrypt.hash(googleId + (process.env.JWT_SECRET || 'secret'), 12);
      const result: any = await dbExecute(
        'INSERT INTO users (name, email, password, phone, role, status, google_id, avatar, is_verified, verification_token, verification_token_expires, addresses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, email, passwordHash, '', 'user', 'active', googleId, avatar || '', 1, null, null, JSON.stringify([])]
      );
      row = { id: result.insertId, name, email, role: 'user' };
    } else if (!row.is_verified) {
      await dbExecute('UPDATE users SET is_verified = ?, verification_token = NULL, verification_token_expires = NULL WHERE id = ?', [1, row.id]);
    }

    res.json({ token: signToken({ id: String(row.id), email, role: row.role || 'user' }), user: { id: String(row.id), name: row.name, email, role: row.role || 'user' } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ message: 'Verification token missing' });
    if (!isDbConnected()) {
      const user = memory.findUserByVerificationToken(token);
      if (!user || !user.verificationTokenExpires) return res.status(400).json({ message: 'Invalid or expired token' });
      if (new Date(user.verificationTokenExpires).getTime() < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      memory.updateUser(user._id, { isVerified: true, verificationToken: null, verificationTokenExpires: null });
      return res.json({ message: 'Email verified successfully' });
    }

    const rows = await dbQuery<any>(
      'SELECT id FROM users WHERE verification_token = ? AND verification_token_expires > NOW() LIMIT 1',
      [token]
    );
    const row = rows[0];
    if (!row) return res.status(400).json({ message: 'Invalid or expired token' });

    await dbExecute('UPDATE users SET is_verified = ?, verification_token = NULL, verification_token_expires = NULL WHERE id = ?', [1, row.id]);
    res.json({ message: 'Email verified successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) {
      const user = memory.listUsers().find((u) => u._id === req.user?.id);
      return res.json(user || null);
    }
    const rows = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
    const row = rows[0];
    if (!row) return res.json(null);
    const user = mapUserRow(row);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
