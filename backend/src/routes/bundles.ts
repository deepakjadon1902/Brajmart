import { Router } from 'express';
import { isDbConnected } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import {
  createBundle,
  ensureCommerceIntelligenceSchema,
  getAdminBundles,
  getPublicBundles,
  setBundleActive,
  updateBundle,
} from '../lib/commerceIntelligence';

const router = Router();

router.get('/', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const bundles = await getPublicBundles({
      location: String(req.query.location || ''),
      limit: Number(req.query.limit || 6),
    });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(bundles);
  } catch {
    res.status(500).json({ message: 'Failed to load bundles' });
  }
});

router.get('/admin', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const bundles = await getAdminBundles();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(bundles);
  } catch {
    res.status(500).json({ message: 'Failed to load admin bundles' });
  }
});

router.post('/admin', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCommerceIntelligenceSchema();
    const result = await createBundle(req as AuthRequest);
    if (!result.ok) return res.status(400).json({ message: result.message });
    const bundles = await getAdminBundles();
    res.status(201).json({ bundle: bundles.find((bundle: any) => Number(bundle.id) === result.bundleId) || null });
  } catch (err: any) {
    const message = err?.message === 'BUNDLE_NOT_FOUND' ? 'Bundle not found' : 'Failed to create bundle';
    res.status(err?.message === 'BUNDLE_NOT_FOUND' ? 404 : 500).json({ message });
  }
});

router.put('/admin/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const bundleId = Number(req.params.id);
    if (!Number.isFinite(bundleId) || bundleId <= 0) return res.status(400).json({ message: 'Valid bundle id is required' });
    const result = await updateBundle(req as AuthRequest, bundleId);
    if (!result.ok) return res.status(400).json({ message: result.message });
    const bundles = await getAdminBundles();
    res.json({ bundle: bundles.find((bundle: any) => Number(bundle.id) === bundleId) || null });
  } catch (err: any) {
    const message = err?.message === 'BUNDLE_NOT_FOUND' ? 'Bundle not found' : 'Failed to update bundle';
    res.status(err?.message === 'BUNDLE_NOT_FOUND' ? 404 : 500).json({ message });
  }
});

router.patch('/admin/:id/status', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const bundleId = Number(req.params.id);
    if (!Number.isFinite(bundleId) || bundleId <= 0) return res.status(400).json({ message: 'Valid bundle id is required' });
    await setBundleActive(req as AuthRequest, bundleId, req.body?.isActive === true);
    const bundles = await getAdminBundles();
    res.json({ bundle: bundles.find((bundle: any) => Number(bundle.id) === bundleId) || null });
  } catch (err: any) {
    const message = err?.message === 'BUNDLE_NOT_FOUND' ? 'Bundle not found' : 'Failed to update bundle status';
    res.status(err?.message === 'BUNDLE_NOT_FOUND' ? 404 : 500).json({ message });
  }
});

export default router;
