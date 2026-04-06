import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerifyEmail } from '../lib/email';

const router = Router();

const signToken = (user: { id: string; email: string; role?: string }) =>
  jwt.sign(user, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';

const buildVerifyLink = (token: string) => `${getFrontendUrl()}/verify-email?token=${token}`;

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
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password, isVerified: true, verificationToken: null, verificationTokenExpires: null });
    res.status(201).json({
      token: signToken({ id: user._id.toString(), email, role: user.role }),
      user: { id: user._id, name, email, role: user.role },
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
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ token: signToken({ id: user._id.toString(), email, role: user.role }), user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Admin login with env credentials
router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body;
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
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: googleId + (process.env.JWT_SECRET || 'secret'),
        googleId,
        avatar,
        isVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      });
    } else if (!user.isVerified) {
      user.isVerified = true;
      user.verificationToken = null;
      user.verificationTokenExpires = null;
      await user.save();
    }
    res.json({ token: signToken({ id: user._id.toString(), email, role: user.role }), user: { id: user._id, name: user.name, email, role: user.role } });
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
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
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
    const user = await User.findById(req.user?.id).select('-password');
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
