import { Router } from 'express';
import { auth, adminOnly } from '../middleware/auth';
import { isDbConnected } from '../lib/db';
import { fetchAdminAuditLogs } from '../lib/adminAudit';

const router = Router();

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const data = await fetchAdminAuditLogs({
      q: String(req.query.q || ''),
      action: String(req.query.action || ''),
      entityType: String(req.query.entityType || ''),
      admin: String(req.query.admin || ''),
      from: String(req.query.from || ''),
      to: String(req.query.to || ''),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 25),
    });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(data);
  } catch {
    res.status(500).json({ message: 'Failed to load audit logs' });
  }
});

export default router;
