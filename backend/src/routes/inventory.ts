import { Router } from 'express';
import { PoolConnection } from 'mysql2/promise';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { buildProductAuditReport } from '../lib/productDataQuality';
import { toIsoString } from '../lib/dbHelpers';
import { insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();

type InventoryStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNMANAGED' | 'INVALID';
type AdjustmentType = 'INCREASE' | 'DECREASE' | 'SET';

const toIntOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
};

const toNonNegativeInt = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
};

const normalizeText = (value: unknown, max = 255) => String(value ?? '').trim().slice(0, max);

const inventoryStatus = (stockQuantity: number | null, reservedQuantity: number, lowStockThreshold: number): InventoryStatus => {
  if (stockQuantity === null) return 'UNMANAGED';
  if (stockQuantity < 0 || reservedQuantity < 0 || reservedQuantity > stockQuantity) return 'INVALID';
  const available = stockQuantity - reservedQuantity;
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available <= lowStockThreshold) return 'LOW_STOCK';
  return 'HEALTHY';
};

const mapInventoryProduct = (row: any) => {
  const stockQuantity = toIntOrNull(row.stock_quantity);
  const reservedQuantity = Math.max(0, toIntOrNull(row.reserved_quantity) ?? 0);
  const lowStockThreshold = Math.max(0, toIntOrNull(row.low_stock_threshold) ?? 0);
  const availableQuantity = stockQuantity === null ? null : Math.max(0, stockQuantity - reservedQuantity);
  return {
    id: String(row.id),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    sku: String(row.sku || ''),
    category: String(row.category_name ?? row.category ?? ''),
    image: String(row.image || ''),
    inStock: Boolean(Number(row.in_stock ?? 0)),
    stockQuantity,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold,
    status: inventoryStatus(stockQuantity, reservedQuantity, lowStockThreshold),
    updatedAt: toIsoString(row.updated_at),
  };
};

const productSelect = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

const loadProductForUpdate = async (connection: PoolConnection, productId: string) => {
  const [rows] = await connection.query(
    `SELECT id, name, stock_quantity, reserved_quantity, low_stock_threshold, sku
     FROM products
     WHERE id = ?
     FOR UPDATE`,
    [productId]
  );
  return (rows as any[])[0] || null;
};

const actorLabel = (req: AuthRequest) => {
  const email = normalizeText(req.user?.email, 80);
  const id = normalizeText(req.user?.id, 30);
  return email || (id ? `admin:${id}` : 'admin');
};

const assertValidStock = (stock: number | null, reserved: number, lowStockThreshold: number) => {
  if (stock !== null && stock < 0) return 'Stock quantity cannot be negative.';
  if (reserved < 0) return 'Reserved quantity cannot be negative.';
  if (stock !== null && reserved > stock) return 'Reserved quantity cannot exceed stock quantity.';
  if (lowStockThreshold < 0) return 'Low stock threshold cannot be negative.';
  return '';
};

router.get('/dashboard', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(`${productSelect} ORDER BY p.updated_at DESC`);
    const products = rows.map(mapInventoryProduct);
    const totals = products.reduce(
      (acc, product) => {
        acc.totalProducts += 1;
        if (product.status === 'HEALTHY' || product.status === 'LOW_STOCK') acc.inStock += 1;
        if (product.status === 'LOW_STOCK') acc.lowStock += 1;
        if (product.status === 'OUT_OF_STOCK') acc.outOfStock += 1;
        if (product.status === 'INVALID') acc.invalid += 1;
        acc.reservedStock += product.reservedQuantity;
        return acc;
      },
      { totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0, invalid: 0, reservedStock: 0 }
    );
    const alerts = products
      .filter((product) => ['LOW_STOCK', 'OUT_OF_STOCK', 'INVALID'].includes(product.status))
      .slice(0, 8);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      generatedAt: new Date().toISOString(),
      totals,
      recentlyUpdated: products.slice(0, 6),
      alerts,
    });
  } catch {
    res.status(500).json({ message: 'Failed to load inventory dashboard' });
  }
});

router.get('/products', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 20)));
    const q = normalizeText(req.query.q, 120).toLowerCase();
    const status = normalizeText(req.query.status, 30).toUpperCase();
    const category = normalizeText(req.query.category, 120).toLowerCase();
    const rows = await dbQuery<any>(`${productSelect} ORDER BY p.updated_at DESC`);
    let products = rows.map(mapInventoryProduct);

    if (q) {
      products = products.filter((product) =>
        [product.name, product.sku, product.category].some((value) => value.toLowerCase().includes(q))
      );
    }
    if (category) products = products.filter((product) => product.category.toLowerCase() === category);
    if (status && status !== 'ALL') products = products.filter((product) => product.status === status);

    const total = products.length;
    const start = (page - 1) * limit;
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: products.slice(start, start + limit),
    });
  } catch {
    res.status(500).json({ message: 'Failed to load inventory products' });
  }
});

router.get('/products/:id/history', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const productRows = await dbQuery<any>(`${productSelect} WHERE p.id = ? LIMIT 1`, [req.params.id]);
    const product = productRows[0];
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const rows = await dbQuery<any>(
      `SELECT it.*, o.status AS order_status
       FROM inventory_transactions it
       LEFT JOIN orders o ON it.order_id = o.id
       WHERE it.product_id = ?
       ORDER BY it.created_at DESC, it.id DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      product: mapInventoryProduct(product),
      transactions: rows.map((row: any) => ({
        id: String(row.id),
        type: row.type,
        quantity: Number(row.quantity || 0),
        previousQuantity: row.previous_quantity === null ? null : Number(row.previous_quantity),
        newQuantity: row.new_quantity === null ? null : Number(row.new_quantity),
        previousReserved: row.previous_reserved === null ? null : Number(row.previous_reserved),
        newReserved: row.new_reserved === null ? null : Number(row.new_reserved),
        reason: String(row.reason || ''),
        createdBy: String(row.created_by || ''),
        orderId: row.order_id === null ? null : String(row.order_id),
        orderStatus: row.order_status || null,
        createdAt: toIsoString(row.created_at),
      })),
    });
  } catch {
    res.status(500).json({ message: 'Failed to load inventory history' });
  }
});

router.post('/products/:id/adjust', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const adjustmentType = normalizeText(req.body?.type, 20).toUpperCase() as AdjustmentType;
    const quantity = toNonNegativeInt(req.body?.quantity);
    const reason = normalizeText(req.body?.reason, 180);
    const note = normalizeText(req.body?.note, 60);

    if (!['INCREASE', 'DECREASE', 'SET'].includes(adjustmentType)) {
      return res.status(400).json({ message: 'Choose increase, decrease, or set quantity.' });
    }
    if (quantity === null || quantity < 0 || (adjustmentType !== 'SET' && quantity <= 0)) {
      return res.status(400).json({ message: 'Enter a valid adjustment quantity.' });
    }
    if (!reason) return res.status(400).json({ message: 'Reason is required for every stock adjustment.' });

    let updatedProduct: any = null;
    await withDbTransaction(async (connection) => {
      const product = await loadProductForUpdate(connection, req.params.id);
      if (!product) throw new Error('Product not found');

      const previousStock = toIntOrNull(product.stock_quantity) ?? 0;
      const previousReserved = Math.max(0, toIntOrNull(product.reserved_quantity) ?? 0);
      const lowStockThreshold = Math.max(0, toIntOrNull(product.low_stock_threshold) ?? 0);
      let newStock = previousStock;

      if (adjustmentType === 'INCREASE') newStock = previousStock + quantity;
      if (adjustmentType === 'DECREASE') newStock = previousStock - quantity;
      if (adjustmentType === 'SET') newStock = quantity;

      const validationMessage = assertValidStock(newStock, previousReserved, lowStockThreshold);
      if (validationMessage) throw new Error(validationMessage);

      const transactionQuantity = Math.abs(newStock - previousStock);
      if (transactionQuantity === 0) throw new Error('Adjustment does not change stock quantity.');

      await connection.execute(
        'UPDATE products SET stock_quantity = ?, in_stock = IF(? - reserved_quantity > 0, 1, 0), updated_at = NOW() WHERE id = ?',
        [newStock, newStock, req.params.id]
      );
      await connection.execute(
        `INSERT INTO inventory_transactions
          (product_id, order_id, type, quantity, previous_quantity, new_quantity, previous_reserved, new_reserved, reason, created_by)
         VALUES (?, NULL, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          transactionQuantity,
          previousStock,
          newStock,
          previousReserved,
          previousReserved,
          note ? `${reason} - ${note}` : reason,
          actorLabel(req),
        ]
      );
      await insertAdminAuditLog(connection, {
        req,
        action: 'INVENTORY_ADJUSTMENT',
        entityType: 'product',
        entityId: req.params.id,
        before: { stockQuantity: previousStock, reservedQuantity: previousReserved },
        after: { stockQuantity: newStock, reservedQuantity: previousReserved },
        reason: note ? `${reason} - ${note}` : reason,
      });
    });

    const rows = await dbQuery<any>(`${productSelect} WHERE p.id = ? LIMIT 1`, [req.params.id]);
    updatedProduct = rows[0] ? mapInventoryProduct(rows[0]) : null;
    res.json({ ok: true, product: updatedProduct });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to adjust stock');
    const status = message === 'Product not found' ? 404 : 400;
    res.status(status).json({ message });
  }
});

router.get('/audit', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ORDER BY p.updated_at DESC`
    );
    const report = buildProductAuditReport(rows);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(report);
  } catch {
    res.status(500).json({ message: 'Failed to audit product data' });
  }
});

router.put('/products/:id/correction', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const allowed = ['name', 'slug', 'sku', 'price', 'originalPrice', 'image', 'category', 'rating', 'reviewCount', 'lowStockThreshold', 'inStock'];
    const body = req.body || {};
    const fields: string[] = [];
    const values: any[] = [];
    const set = (column: string, value: any) => {
      fields.push(`\`${column}\` = ?`);
      values.push(value);
    };

    if (body.name !== undefined) {
      const value = normalizeText(body.name, 255);
      if (!value) return res.status(400).json({ message: 'Product name is required.' });
      set('name', value);
    }
    if (body.slug !== undefined) {
      const value = normalizeText(body.slug, 255);
      if (!value) return res.status(400).json({ message: 'Slug is required.' });
      const duplicates = await dbQuery<any>('SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1', [value, req.params.id]);
      if (duplicates.length) return res.status(400).json({ message: 'Slug already exists on another product.' });
      set('slug', value);
    }
    if (body.sku !== undefined) {
      const value = normalizeText(body.sku, 120);
      if (!value) return res.status(400).json({ message: 'SKU is required for inventory-managed products.' });
      const duplicates = await dbQuery<any>('SELECT id FROM products WHERE sku = ? AND id <> ? LIMIT 1', [value, req.params.id]);
      if (duplicates.length) return res.status(400).json({ message: 'SKU already exists on another product.' });
      set('sku', value);
    }
    if (body.price !== undefined) {
      const value = Number(body.price);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Sale price must be greater than 0.' });
      set('price', value);
    }
    if (body.originalPrice !== undefined) {
      const value = body.originalPrice === null || body.originalPrice === '' ? null : Number(body.originalPrice);
      if (value !== null && (!Number.isFinite(value) || value <= 0)) return res.status(400).json({ message: 'MRP must be greater than 0 when provided.' });
      set('original_price', value);
    }
    if (body.image !== undefined) {
      const value = normalizeText(body.image, 1024);
      if (!value) return res.status(400).json({ message: 'Primary image is required.' });
      set('image', value);
    }
    if (body.category !== undefined) {
      const value = normalizeText(body.category, 255);
      if (!value) return res.status(400).json({ message: 'Category is required.' });
      const categoryRows = await dbQuery<any>('SELECT id FROM categories WHERE name = ? LIMIT 1', [value]);
      if (!categoryRows.length) return res.status(400).json({ message: 'Choose an existing category.' });
      set('category', value);
      set('category_id', categoryRows[0].id);
    }
    if (body.rating !== undefined) {
      const value = Number(body.rating);
      if (!Number.isFinite(value) || value < 0 || value > 5) return res.status(400).json({ message: 'Rating must be between 0 and 5.' });
      set('rating', value);
    }
    if (body.reviewCount !== undefined) {
      const value = toNonNegativeInt(body.reviewCount);
      if (value === null || value < 0) return res.status(400).json({ message: 'Review count cannot be negative.' });
      set('review_count', value);
    }
    if (body.lowStockThreshold !== undefined) {
      const value = toNonNegativeInt(body.lowStockThreshold);
      if (value === null || value < 0) return res.status(400).json({ message: 'Low stock threshold cannot be negative.' });
      set('low_stock_threshold', value);
    }
    if (body.inStock !== undefined) set('in_stock', body.inStock ? 1 : 0);

    const disallowed = Object.keys(body).filter((key) => !allowed.includes(key));
    if (disallowed.length) return res.status(400).json({ message: `Unsupported correction fields: ${disallowed.join(', ')}` });
    if (!fields.length) return res.status(400).json({ message: 'No correction fields provided.' });

    const existingRows = await dbQuery<any>('SELECT price, original_price FROM products WHERE id = ? LIMIT 1', [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: 'Product not found' });
    const nextPrice = body.price !== undefined ? Number(body.price) : Number(existing.price);
    const nextMrp = body.originalPrice !== undefined
      ? (body.originalPrice === null || body.originalPrice === '' ? null : Number(body.originalPrice))
      : (existing.original_price === null ? null : Number(existing.original_price));
    if (nextMrp !== null && nextPrice > nextMrp) return res.status(400).json({ message: 'Sale price cannot be higher than MRP.' });

    fields.push('updated_at = NOW()');
    await dbExecute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    const rows = await dbQuery<any>(`${productSelect} WHERE p.id = ? LIMIT 1`, [req.params.id]);
    res.json({ ok: true, product: mapInventoryProduct(rows[0]) });
  } catch {
    res.status(500).json({ message: 'Failed to save product correction' });
  }
});

export default router;
