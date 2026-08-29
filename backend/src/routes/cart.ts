import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { parseJson, toIsoString } from '../lib/dbHelpers';
import { computeTotals, getCheckoutSettings } from '../lib/orderPricing';

const router = Router();

const mapCartRow = (row: any) => ({
  _id: String(row.id),
  userId: String(row.user_id),
  items: parseJson(row.items, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const row = rows[0];
    res.json(row ? mapCartRow(row) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const items = req.body.items || [];
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    await dbExecute(
      'INSERT INTO carts (user_id, items) VALUES (?, ?) ON DUPLICATE KEY UPDATE items = VALUES(items), updated_at = NOW()',
      [userId, JSON.stringify(items)]
    );
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('UPDATE carts SET items = ?, updated_at = NOW() WHERE user_id = ?', [JSON.stringify([]), userId]);
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const inputItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const settings = await getCheckoutSettings();
    if (inputItems.length > 120) {
      return res.status(400).json({ message: 'Cart can contain up to 120 line items' });
    }
    if (!inputItems.length) {
      return res.json({
        items: [],
        subtotal: 0,
        discount: 0,
        shipping: 0,
        packaging: 0,
        codFee: settings.codFee,
        grandTotal: 0,
        currency: 'INR',
        changes: [],
        unavailableItems: [],
        pricingVersion: 'cart-v1',
        validatedAt: new Date().toISOString(),
      });
    }

    const requested = inputItems
      .map((item: any) => ({
        raw: item,
        productId: String(item.productId || item.id || item._id || item.product?.id || item.product?._id || '').split('::')[0],
        quantity: Math.max(1, Math.floor(Number(item.quantity || 1) || 1)),
      }))
      .filter((item: any) => item.productId);
    const ids = Array.from(new Set(requested.map((item: any) => item.productId)));
    const rows = ids.length
      ? await dbQuery<any>(
          `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           LEFT JOIN subcategories s ON p.subcategory_id = s.id
           WHERE p.id IN (${ids.map(() => '?').join(',')}) AND p.archived_at IS NULL`,
          ids
        )
      : [];
    const byId = new Map<string, any>((rows || []).map((row: any) => [String(row.id), row]));
    const changes: any[] = [];
    const unavailableItems: any[] = [];
    const validatedItems: any[] = [];
    let subtotal = 0;
    let discount = 0;

    for (const item of requested) {
      const product = byId.get(item.productId);
      const snapshot = item.raw?.product || item.raw || {};
      if (!product) {
        unavailableItems.push({ productId: item.productId, reason: 'missing', message: 'This product is no longer available.' });
        changes.push({ productId: item.productId, type: 'unavailable', message: 'A product in your cart is no longer available.' });
        continue;
      }

      const currentPrice = Number(product.price || 0);
      const originalPrice = product.original_price === null || product.original_price === undefined ? null : Number(product.original_price);
      const snapshotPrice = Number(snapshot.price || item.raw?.price || 0);
      const inStock = Boolean(Number(product.in_stock));
      const available = product.stock_quantity === null || product.stock_quantity === undefined
        ? null
        : Math.max(0, Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0));
      const requestedQuantity = settings.maxOrderQuantity > 0 ? Math.min(item.quantity, settings.maxOrderQuantity) : item.quantity;
      const availableQuantity = available === null ? requestedQuantity : Math.min(requestedQuantity, available);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        unavailableItems.push({ productId: item.productId, name: product.name, reason: 'invalid_price', message: `${product.name} cannot be purchased right now.` });
        changes.push({ productId: item.productId, type: 'unavailable', message: `${product.name} cannot be purchased right now.` });
        continue;
      }

      if (!inStock || availableQuantity <= 0) {
        unavailableItems.push({ productId: item.productId, name: product.name, reason: 'out_of_stock', message: `${product.name} is currently unavailable.` });
        changes.push({ productId: item.productId, type: 'stock', message: `${product.name} is currently unavailable.` });
        continue;
      }

      if (snapshotPrice > 0 && snapshotPrice !== currentPrice) {
        changes.push({
          productId: item.productId,
          type: 'price',
          message: `Price updated for ${product.name}.`,
          previousPrice: snapshotPrice,
          currentPrice,
        });
      }
      if (settings.maxOrderQuantity > 0 && item.quantity > settings.maxOrderQuantity) {
        changes.push({
          productId: item.productId,
          type: 'quantity',
          message: `Maximum quantity for ${product.name} is ${settings.maxOrderQuantity}.`,
          requestedQuantity: item.quantity,
          currentQuantity: settings.maxOrderQuantity,
        });
      }
      if (available !== null && availableQuantity < requestedQuantity) {
        changes.push({
          productId: item.productId,
          type: 'quantity',
          message: `Only ${availableQuantity} available for ${product.name}.`,
          requestedQuantity,
          currentQuantity: availableQuantity,
        });
      }

      subtotal += currentPrice * availableQuantity;
      if (originalPrice && originalPrice > currentPrice) discount += (originalPrice - currentPrice) * availableQuantity;
      validatedItems.push({
        productId: String(product.id),
        id: String(product.id),
        name: String(product.name || ''),
        slug: String(product.slug || ''),
        image: String(product.image || ''),
        category: String(product.category_name || product.category || ''),
        price: currentPrice,
        originalPrice: originalPrice && originalPrice > currentPrice ? originalPrice : null,
        requestedQuantity: item.quantity,
        quantity: availableQuantity,
        availableQuantity: available,
        inStock,
        selectedSize: snapshot.selectedSize || item.raw.selectedSize,
        selectedPieces: snapshot.selectedPieces || item.raw.selectedPieces,
        selectedAttributes: snapshot.selectedAttributes || item.raw.selectedAttributes,
      });
    }

    const totals = subtotal > 0 ? computeTotals(subtotal, settings) : { itemsSubtotal: 0, packaging: 0, shipping: 0, total: 0 };
    res.json({
      items: validatedItems,
      subtotal,
      discount,
      shipping: totals.shipping,
      packaging: totals.packaging,
      codFee: settings.codFee,
      grandTotal: totals.total,
      currency: 'INR',
      changes,
      unavailableItems,
      pricingVersion: 'cart-v1',
      validatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.error('Cart validation failed:', err);
    res.status(500).json({ message: 'Failed to validate cart' });
  }
});

export default router;
