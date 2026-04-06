import { Router } from 'express';
import Settings from '../models/Settings';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.getSettings());
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const updated = memory.updateSettings(req.body);
      return res.json(updated);
    }
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
