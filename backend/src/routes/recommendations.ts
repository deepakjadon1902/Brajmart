import { Router } from 'express';
import { isDbConnected } from '../lib/db';
import { getCartRecommendations, getProductRecommendations } from '../lib/commerceIntelligence';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
const recommendationReadLimit = rateLimit('recommendations:read', {
  windowMs: 60 * 1000,
  max: 120,
});

const safeLimit = (value: unknown, fallback = 8) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(16, Math.max(1, Math.floor(n))) : fallback;
};

router.get('/product/:productId', recommendationReadLimit, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) return res.status(400).json({ message: 'Valid product id is required' });
    const result = await getProductRecommendations(productId, safeLimit(req.query.limit));
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(result);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Product recommendation failed:', err);
    res.status(500).json({ message: 'Failed to load recommendations' });
  }
});

router.post('/cart', recommendationReadLimit, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds.map(Number) : [];
    const result = await getCartRecommendations(productIds, safeLimit(req.body?.limit));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(result);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Cart recommendation failed:', err);
    res.status(500).json({ message: 'Failed to load cart recommendations' });
  }
});

export default router;
