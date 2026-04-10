import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import bcrypt from 'bcryptjs';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';
import { sendVerifyEmail, sendVerifyOtp } from '../lib/email';

const router = Router();

const signToken = (user: { id: string; email: string; role?: string }) =>
  jwt.sign(user, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

const getOauthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const redirectUri = `${backendUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

const buildVerifyLink = (token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  return `${frontendUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
};

const OTP_MINUTES = 10;
const createOtp = () => {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  return { otp, expires: new Date(Date.now() + OTP_MINUTES * 60 * 1000) };
};

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
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const existing = await dbQuery<any>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) return res.status(400).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verification = createOtp();
    const result: any = await dbExecute(
      'INSERT INTO users (name, email, password, phone, role, status, google_id, avatar, is_verified, verification_token, verification_token_expires, addresses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, passwordHash, '', 'user', 'active', null, '', 0, verification.otp, verification.expires, JSON.stringify([])]
    );

    const userId = String(result.insertId);
    try {
      await sendVerifyOtp(email, { otp: verification.otp, minutes: OTP_MINUTES });
    } catch {
      await dbExecute('DELETE FROM users WHERE id = ?', [userId]);
      return res.status(500).json({ message: 'Unable to send verification email. Please try again.' });
    }

    res.status(201).json({ message: 'Verification code sent to your email.' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (row.status && row.status !== 'active') {
      return res.status(403).json({ message: 'Account is blocked. Please contact support.' });
    }
    if (!row.is_verified) {
      const verification = createOtp();
      await dbExecute(
        'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
        [verification.otp, verification.expires, row.id]
      );
      try {
        await sendVerifyOtp(row.email, { otp: verification.otp, minutes: OTP_MINUTES });
      } catch {
        return res.status(500).json({ message: 'Unable to send verification email. Please try again.' });
      }
      return res.status(403).json({ message: 'Please verify your email. A new verification code has been sent.', code: 'EMAIL_NOT_VERIFIED', email: row.email });
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

router.get('/google/start', async (_req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).json({ message: 'Google OAuth not configured' });

    const client = getOauthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
    });
    res.redirect(url);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to start Google OAuth' });
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Missing Google code');
    if (!isDbConnected()) return res.status(503).send('Database unavailable');

    const client = getOauthClient();
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) return res.status(400).send('Missing Google ID token');

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload?.name || !payload?.sub) return res.status(400).send('Invalid Google profile');
    if (!payload.email_verified) return res.status(403).send('Google email not verified');

    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;
    const avatar = payload.picture || '';

    const rows = await dbQuery<any>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    let row = rows[0];
    if (!row) {
      const passwordHash = await bcrypt.hash(googleId + (process.env.JWT_SECRET || 'secret'), 12);
      const result: any = await dbExecute(
        'INSERT INTO users (name, email, password, phone, role, status, google_id, avatar, is_verified, verification_token, verification_token_expires, addresses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, email, passwordHash, '', 'user', 'active', googleId, avatar, 1, null, null, JSON.stringify([])]
      );
      row = { id: result.insertId, name, email, role: 'user', status: 'active' };
    } else {
      if (row.status && row.status !== 'active') return res.status(403).send('Account is blocked');
      await dbExecute(
        'UPDATE users SET google_id = ?, avatar = ?, is_verified = ?, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
        [row.google_id || googleId, avatar || row.avatar || '', 1, row.id]
      );
    }

    const token = signToken({ id: String(row.id), email, role: row.role || 'user' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const redirectUrl = `${frontendUrl.replace(/\/$/, '')}/oauth-callback?token=${encodeURIComponent(token)}`;
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).send(err?.message || 'Google OAuth failed');
  }
});

router.get('/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ message: 'Verification token missing' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

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

router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>(
      'SELECT id, verification_token_expires FROM users WHERE LOWER(email) = ? AND verification_token = ? LIMIT 1',
      [email, otp]
    );
    const row = rows[0];
    if (!row) return res.status(400).json({ message: 'Invalid code' });
    if (row.verification_token_expires && new Date(row.verification_token_expires) < new Date()) {
      return res.status(400).json({ message: 'Code expired' });
    }

    await dbExecute('UPDATE users SET is_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?', [row.id]);

    const refreshed = await dbQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [row.id]);
    const userRow = refreshed[0];
    if (!userRow) return res.json({ message: 'Email verified successfully' });
    const token = signToken({ id: String(userRow.id), email: userRow.email, role: userRow.role || 'user' });
    res.json({ message: 'Email verified successfully', token, user: { id: String(userRow.id), name: userRow.name, email: userRow.email, role: userRow.role || 'user' } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Verification failed' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT id, is_verified FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'User not found' });
    if (row.is_verified) return res.status(400).json({ message: 'Email already verified' });

    const verification = createOtp();
    await dbExecute(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verification.otp, verification.expires, row.id]
    );
    await sendVerifyOtp(email, { otp: verification.otp, minutes: OTP_MINUTES });
    res.json({ message: 'Verification code sent.' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Unable to resend code' });
  }
});

router.get('/me', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
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
