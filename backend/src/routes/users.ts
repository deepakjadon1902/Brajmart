import { Router } from 'express';
import User from '../models/User';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listUsers());
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
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
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
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
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-password');
    res.json(user);
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
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-password');
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json({ message: 'User deleted' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
