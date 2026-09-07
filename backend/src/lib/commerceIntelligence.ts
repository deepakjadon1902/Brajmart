import { dbExecute, dbQuery, withDbTransaction } from './db';
import { parseJson, toIsoString, boolFromDb } from './dbHelpers';
import { approvedReviewAggregateSql } from './reviewAggregates';
import { paidOnlinePaymentExistsSql } from './orderVisibility';
import { mapProductRow } from '../routes/products';
import { AuthRequest } from '../middleware/auth';
import { insertAdminAuditLog } from './adminAudit';

type OrderItem = {
  productId?: string | number;
  id?: string | number;
  _id?: string | number;
  product?: { id?: string | number; _id?: string | number };
};

const RECOMMENDATION_CACHE_TTL_MS = 60_000;
const recommendationCache = new Map<string, { at: number; data: any }>();
const RECOMMENDATION_SOURCES = {
  CO_PURCHASE: 'CO_PURCHASE',
  CURATED: 'CURATED',
  SAME_CATEGORY: 'SAME_CATEGORY',
  FALLBACK: 'FALLBACK',
} as const;

export const clearCommerceIntelligenceCache = () => {
  recommendationCache.clear();
};

const slugify = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const uniqueNumericIds = (input: unknown[]) => {
  const seen = new Set<number>();
  const output: number[] = [];
  for (const value of input || []) {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
  }
  return output;
};

const getOrderProductId = (item: OrderItem) =>
  Number(item?.productId ?? item?.id ?? item?._id ?? item?.product?.id ?? item?.product?._id ?? 0);

const mapBundleRow = (row: any, products: any[] = []) => {
  const total = products.reduce((sum, product) => sum + Number(product.price || 0), 0);
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    sku: row.sku || '',
    description: row.description || '',
    imageUrl: row.image_url || '',
    displayLocation: row.display_location || 'product_detail',
    sortOrder: Number(row.sort_order || 0),
    isActive: boolFromDb(row.is_active),
    startsAt: toIsoString(row.starts_at),
    endsAt: toIsoString(row.ends_at),
    archivedAt: toIsoString(row.archived_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    products,
    productCount: products.length,
    bundlePrice: total,
    savings: 0,
  };
};

export const ensureCommerceIntelligenceSchema = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS bundles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(180) NOT NULL,
      sku VARCHAR(120) NULL,
      description TEXT NULL,
      image_url VARCHAR(1024) NULL,
      display_location VARCHAR(80) NOT NULL DEFAULT 'product_detail',
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      starts_at DATETIME NULL,
      ends_at DATETIME NULL,
      created_by VARCHAR(120) NULL,
      updated_by VARCHAR(120) NULL,
      archived_at DATETIME NULL,
      archived_by VARCHAR(120) NULL,
      archive_reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bundles_slug (slug),
      KEY idx_bundles_active_location (is_active, display_location, sort_order),
      KEY idx_bundles_archived (archived_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await dbExecute('ALTER TABLE bundles ADD COLUMN sku VARCHAR(120) NULL AFTER slug').catch((err: any) => {
    if (!String(err?.message || '').includes('Duplicate column name')) throw err;
  });
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS bundle_products (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bundle_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bundle_products_item (bundle_id, product_id),
      KEY idx_bundle_products_bundle_sort (bundle_id, sort_order),
      KEY idx_bundle_products_product (product_id),
      CONSTRAINT fk_bundle_products_bundle FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
      CONSTRAINT fk_bundle_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const validProductWhere = (alias = 'p') => `
  ${alias}.archived_at IS NULL
  AND ${alias}.price > 0
  AND ${alias}.in_stock = 1
  AND (
    ${alias}.stock_quantity IS NULL
    OR (
      ${alias}.stock_quantity >= 0
      AND COALESCE(${alias}.reserved_quantity, 0) >= 0
      AND COALESCE(${alias}.reserved_quantity, 0) <= ${alias}.stock_quantity
      AND (${alias}.stock_quantity - COALESCE(${alias}.reserved_quantity, 0)) > 0
    )
  )
`;

const fetchValidProductsByIds = async (ids: number[]) => {
  const productIds = uniqueNumericIds(ids);
  if (!productIds.length) return [];
  const rows = await dbQuery<any>(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
     WHERE p.id IN (${productIds.map(() => '?').join(',')})
       AND ${validProductWhere('p')}`,
    productIds
  );
  const byId = new Map(rows.map((row: any) => [Number(row.id), mapProductRow(row)]));
  return productIds.map((id) => byId.get(id)).filter(Boolean);
};

const fetchValidProducts = async (opts: { excludeIds?: number[]; category?: string; limit?: number; ids?: number[] } = {}) => {
  const params: any[] = [];
  const where = [validProductWhere('p')];
  if (opts.ids?.length) {
    where.push(`p.id IN (${opts.ids.map(() => '?').join(',')})`);
    params.push(...opts.ids);
  }
  if (opts.excludeIds?.length) {
    where.push(`p.id NOT IN (${opts.excludeIds.map(() => '?').join(',')})`);
    params.push(...opts.excludeIds);
  }
  if (opts.category) {
    where.push('LOWER(TRIM(COALESCE(c.name, p.category))) = LOWER(TRIM(?))');
    params.push(opts.category);
  }
  const limit = Math.min(24, Math.max(1, Number(opts.limit || 8)));
  params.push(limit);
  const rows = await dbQuery<any>(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(ra.real_review_count, 0) DESC, COALESCE(ra.real_rating, 0) DESC, p.created_at DESC, p.id DESC
     LIMIT ?`,
    params
  );
  return rows.map(mapProductRow);
};

const cacheGet = <T>(key: string): T | null => {
  const cached = recommendationCache.get(key);
  if (!cached || Date.now() - cached.at > RECOMMENDATION_CACHE_TTL_MS) return null;
  return cached.data as T;
};

const cacheSet = <T>(key: string, data: T) => {
  recommendationCache.set(key, { at: Date.now(), data });
  return data;
};

export const getProductRecommendations = async (productId: number, limit = 8) => {
  const safeLimit = Math.min(16, Math.max(1, Number(limit || 8)));
  const cacheKey = `product:${productId}:${safeLimit}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const anchorRows = await dbQuery<any>(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     WHERE p.id = ? AND ${validProductWhere('p')}
     LIMIT 1`,
    [productId]
  );
  const anchor = anchorRows[0];
  if (!anchor) return cacheSet(cacheKey, { productId: String(productId), sections: [], recommendations: [] });

  const orderRows = await dbQuery<any>(
    `SELECT o.id, o.items
     FROM orders o
     WHERE o.status IN ('confirmed','processing','shipped','out_for_delivery','delivered')
       AND (
         ${paidOnlinePaymentExistsSql('o')}
         OR (LOWER(o.payment_method) IN ('cod', 'cash on delivery') AND o.status = 'delivered')
       )
     ORDER BY o.created_at DESC
     LIMIT 600`
  );

  let anchorOrderCount = 0;
  const pairCounts = new Map<number, number>();
  for (const order of orderRows) {
    const itemIds = uniqueNumericIds(parseJson<OrderItem[]>(order.items, []).map(getOrderProductId));
    if (!itemIds.includes(productId)) continue;
    anchorOrderCount += 1;
    for (const id of itemIds) {
      if (id !== productId) pairCounts.set(id, (pairCounts.get(id) || 0) + 1);
    }
  }

  const coPurchaseIds = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id]) => id)
    .slice(0, safeLimit);
  const coProducts = await fetchValidProductsByIds(coPurchaseIds);
  const coProductIds = new Set(coProducts.map((p: any) => Number(p.id)));
  const frequentlyBoughtTogether = coProducts.map((product: any) => {
    const count = pairCounts.get(Number(product.id)) || 0;
    return {
      product,
      type: 'frequently_bought_together',
      sourceType: RECOMMENDATION_SOURCES.CO_PURCHASE,
      label: 'Frequently bought together',
      reason: 'Purchased in valid orders with this product',
      confidence: anchorOrderCount ? Number((count / anchorOrderCount).toFixed(3)) : 0,
    };
  });

  const activeBundleRows = await dbQuery<any>(
    `SELECT DISTINCT b.*
     FROM bundles b
     JOIN bundle_products bp ON bp.bundle_id = b.id
     WHERE bp.product_id = ?
       AND b.is_active = 1
       AND b.archived_at IS NULL
       AND (b.starts_at IS NULL OR b.starts_at <= NOW())
       AND (b.ends_at IS NULL OR b.ends_at >= NOW())
     ORDER BY b.sort_order ASC, b.created_at DESC
     LIMIT 4`,
    [productId]
  );
  const bundleProductIds = activeBundleRows.length
    ? await dbQuery<any>(
        `SELECT bp.bundle_id, bp.product_id
         FROM bundle_products bp
         WHERE bp.bundle_id IN (${activeBundleRows.map(() => '?').join(',')})
         ORDER BY bp.sort_order ASC, bp.id ASC`,
        activeBundleRows.map((row: any) => row.id)
      )
    : [];
  const curatedIds = uniqueNumericIds(bundleProductIds.map((row: any) => Number(row.product_id)).filter((id: number) => id !== productId && !coProductIds.has(id)));
  const curatedProducts = await fetchValidProductsByIds(curatedIds.slice(0, safeLimit));
  const curatedBundleItems = curatedProducts.map((product: any) => ({
    product,
    type: 'curated_bundle',
    sourceType: RECOMMENDATION_SOURCES.CURATED,
    label: 'Complete the set',
    reason: 'Curated in an active BrajMart bundle',
    confidence: 1,
  }));

  const categoryProducts = await fetchValidProducts({
    excludeIds: [productId, ...coProducts.map((p: any) => Number(p.id)), ...curatedProducts.map((p: any) => Number(p.id))],
    category: String(anchor.category_name || anchor.category || ''),
    limit: safeLimit,
  });
  const relatedProducts = categoryProducts.map((product: any) => ({
    product,
    type: 'related_products',
    sourceType: RECOMMENDATION_SOURCES.SAME_CATEGORY,
    label: 'Related products',
    reason: 'Same product category',
    confidence: 0,
  }));

  const all = [...frequentlyBoughtTogether, ...curatedBundleItems, ...relatedProducts].slice(0, safeLimit);
  const sections = [
    frequentlyBoughtTogether.length ? { type: 'frequently_bought_together', sourceType: RECOMMENDATION_SOURCES.CO_PURCHASE, title: 'Frequently Bought Together', items: frequentlyBoughtTogether } : null,
    curatedBundleItems.length ? { type: 'curated_bundle', sourceType: RECOMMENDATION_SOURCES.CURATED, title: 'Complete the Set', items: curatedBundleItems } : null,
    relatedProducts.length ? { type: 'related_products', sourceType: RECOMMENDATION_SOURCES.SAME_CATEGORY, title: 'Related Products', items: relatedProducts.slice(0, Math.max(0, safeLimit - frequentlyBoughtTogether.length - curatedBundleItems.length)) } : null,
  ].filter(Boolean);

  return cacheSet(cacheKey, { productId: String(productId), sections, recommendations: all });
};

export const getCartRecommendations = async (productIds: number[], limit = 8) => {
  const ids = uniqueNumericIds(productIds).slice(0, 20);
  const safeLimit = Math.min(12, Math.max(1, Number(limit || 8)));
  const cacheKey = `cart:${ids.join(',')}:${safeLimit}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const byProduct = await Promise.all(ids.map((id) => getProductRecommendations(id, safeLimit)));
  const seen = new Set(ids);
  const coPurchase: any[] = [];
  const fallback: any[] = [];
  for (const result of byProduct) {
    for (const item of result.recommendations || []) {
      const id = Number(item?.product?.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (item.sourceType === RECOMMENDATION_SOURCES.CO_PURCHASE || item.type === 'frequently_bought_together') coPurchase.push({ ...item, label: 'Often paired with your items' });
      else fallback.push({ ...item, label: 'Complete your order' });
    }
  }
  let recommendations = [...coPurchase, ...fallback].slice(0, safeLimit);
  if (recommendations.length < safeLimit) {
    const products = await fetchValidProducts({ excludeIds: [...seen], limit: safeLimit - recommendations.length });
    recommendations = [
      ...recommendations,
      ...products.map((product: any) => ({
        product,
        type: 'popular_fallback',
        sourceType: RECOMMENDATION_SOURCES.FALLBACK,
        label: 'Complete your order',
        reason: 'Safe catalog fallback',
        confidence: 0,
      })),
    ];
  }
  return cacheSet(cacheKey, { productIds: ids.map(String), recommendations });
};

export const getPublicBundles = async (opts: { location?: string; limit?: number } = {}) => {
  await ensureCommerceIntelligenceSchema();
  const location = String(opts.location || '').trim();
  const limit = Math.min(12, Math.max(1, Number(opts.limit || 6)));
  const params: any[] = [];
  const where = [
    'b.is_active = 1',
    'b.archived_at IS NULL',
    '(b.starts_at IS NULL OR b.starts_at <= NOW())',
    '(b.ends_at IS NULL OR b.ends_at >= NOW())',
  ];
  if (location) {
    where.push('b.display_location = ?');
    params.push(location);
  }
  params.push(limit);
  const bundles = await dbQuery<any>(
    `SELECT b.*
     FROM bundles b
     WHERE ${where.join(' AND ')}
     ORDER BY b.sort_order ASC, b.created_at DESC
     LIMIT ?`,
    params
  );
  if (!bundles.length) return [];
  const products = await dbQuery<any>(
    `SELECT bp.bundle_id, p.*, c.name AS category_name, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
     FROM bundle_products bp
     JOIN products p ON p.id = bp.product_id
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
     WHERE bp.bundle_id IN (${bundles.map(() => '?').join(',')})
       AND ${validProductWhere('p')}
     ORDER BY bp.bundle_id ASC, bp.sort_order ASC, bp.id ASC`,
    bundles.map((bundle: any) => bundle.id)
  );
  const grouped = new Map<number, any[]>();
  for (const row of products) {
    const bundleId = Number(row.bundle_id);
    grouped.set(bundleId, [...(grouped.get(bundleId) || []), mapProductRow(row)]);
  }
  return bundles
    .map((bundle: any) => mapBundleRow(bundle, grouped.get(Number(bundle.id)) || []))
    .filter((bundle: any) => bundle.products.length > 0);
};

export const getAdminBundles = async () => {
  await ensureCommerceIntelligenceSchema();
  const rows = await dbQuery<any>('SELECT * FROM bundles WHERE archived_at IS NULL ORDER BY sort_order ASC, created_at DESC');
  if (!rows.length) return [];
  const products = await dbQuery<any>(
    `SELECT bp.bundle_id, bp.product_id, bp.sort_order, p.name, p.slug, p.price, p.image, p.archived_at, p.in_stock, p.stock_quantity, p.reserved_quantity
     FROM bundle_products bp
     LEFT JOIN products p ON p.id = bp.product_id
     WHERE bp.bundle_id IN (${rows.map(() => '?').join(',')})
     ORDER BY bp.bundle_id ASC, bp.sort_order ASC`,
    rows.map((row: any) => row.id)
  );
  const grouped = new Map<number, any[]>();
  for (const product of products) {
    grouped.set(Number(product.bundle_id), [...(grouped.get(Number(product.bundle_id)) || []), {
      id: String(product.product_id),
      name: product.name || 'Missing product',
      slug: product.slug || '',
      price: Number(product.price || 0),
      image: product.image || '',
      sortOrder: Number(product.sort_order || 0),
      isValid: Boolean(product.name) && !product.archived_at && Number(product.price) > 0 && boolFromDb(product.in_stock),
    }]);
  }
  return rows.map((row: any) => mapBundleRow(row, grouped.get(Number(row.id)) || []));
};

const validateBundlePayload = async (body: any, partial = false) => {
  const name = String(body?.name || '').trim();
  const slug = slugify(body?.slug || name);
  if (!partial && (!name || !slug)) return { ok: false as const, message: 'Bundle name and slug are required' };
  const productIds = Array.isArray(body?.productIds) ? uniqueNumericIds(body.productIds) : [];
  if (!partial && productIds.length < 2) return { ok: false as const, message: 'Bundle requires at least 2 products' };
  if (productIds.length > 12) return { ok: false as const, message: 'Bundle can include up to 12 products' };
  if (Array.isArray(body?.productIds) && productIds.length !== body.productIds.length) {
    return { ok: false as const, message: 'Bundle products must be unique valid product IDs' };
  }
  if (productIds.length) {
    const valid = await fetchValidProductsByIds(productIds);
    if (valid.length !== productIds.length) return { ok: false as const, message: 'Bundle contains unavailable, archived, or invalid products' };
  }
  return {
    ok: true as const,
    data: {
      name,
      slug,
      sku: String(body?.sku || '').trim().slice(0, 120),
      description: String(body?.description || '').trim(),
      imageUrl: String(body?.imageUrl || body?.image_url || '').trim(),
      displayLocation: slugify(body?.displayLocation || body?.display_location || 'product_detail') || 'product_detail',
      sortOrder: Math.max(0, Math.floor(Number(body?.sortOrder ?? body?.sort_order ?? 0) || 0)),
      isActive: body?.isActive === true || body?.is_active === true,
      productIds,
    },
  };
};

export const createBundle = async (req: AuthRequest) => {
  const validated = await validateBundlePayload(req.body);
  if (!validated.ok) return validated;
  const data = validated.data;
  const actor = req.user?.email || req.user?.id || null;
  const result = await withDbTransaction(async (connection) => {
    const [inserted]: any = await connection.execute(
      `INSERT INTO bundles (name, slug, sku, description, image_url, display_location, sort_order, is_active, starts_at, ends_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.slug,
        data.sku || null,
        data.description,
        data.imageUrl || null,
        data.displayLocation,
        data.sortOrder,
        data.isActive ? 1 : 0,
        req.body?.startsAt || req.body?.starts_at || null,
        req.body?.endsAt || req.body?.ends_at || null,
        actor,
        actor,
      ]
    );
    const bundleId = Number(inserted.insertId);
    for (const [index, productId] of data.productIds.entries()) {
      await connection.execute('INSERT INTO bundle_products (bundle_id, product_id, sort_order) VALUES (?, ?, ?)', [bundleId, productId, index + 1]);
    }
    const [bundleRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    await insertAdminAuditLog(connection, {
      req,
      action: 'BUNDLE_CREATE',
      entityType: 'bundle',
      entityId: bundleId,
      after: { ...bundleRows[0], productIds: data.productIds },
      reason: 'Bundle created',
    });
    return bundleId;
  });
  clearCommerceIntelligenceCache();
  return { ok: true as const, bundleId: result };
};

export const updateBundle = async (req: AuthRequest, bundleId: number) => {
  const validated = await validateBundlePayload(req.body, true);
  if (!validated.ok) return validated;
  const data = validated.data;
  const actor = req.user?.email || req.user?.id || null;
  await withDbTransaction(async (connection) => {
    const [beforeRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    if (!beforeRows[0]) throw new Error('BUNDLE_NOT_FOUND');
    const fields: string[] = [];
    const values: any[] = [];
    const set = (column: string, value: any) => {
      fields.push(`${column} = ?`);
      values.push(value);
    };
    if (req.body?.name !== undefined) set('name', data.name);
    if (req.body?.slug !== undefined || req.body?.name !== undefined) set('slug', data.slug);
    if (req.body?.sku !== undefined) set('sku', data.sku || null);
    if (req.body?.description !== undefined) set('description', data.description);
    if (req.body?.imageUrl !== undefined || req.body?.image_url !== undefined) set('image_url', data.imageUrl || null);
    if (req.body?.displayLocation !== undefined || req.body?.display_location !== undefined) set('display_location', data.displayLocation);
    if (req.body?.sortOrder !== undefined || req.body?.sort_order !== undefined) set('sort_order', data.sortOrder);
    if (req.body?.isActive !== undefined || req.body?.is_active !== undefined) set('is_active', data.isActive ? 1 : 0);
    if (req.body?.startsAt !== undefined || req.body?.starts_at !== undefined) set('starts_at', req.body?.startsAt || req.body?.starts_at || null);
    if (req.body?.endsAt !== undefined || req.body?.ends_at !== undefined) set('ends_at', req.body?.endsAt || req.body?.ends_at || null);
    set('updated_by', actor);
    fields.push('updated_at = NOW()');
    await connection.execute(`UPDATE bundles SET ${fields.join(', ')} WHERE id = ?`, [...values, bundleId]);
    if (Array.isArray(req.body?.productIds)) {
      await connection.execute('DELETE FROM bundle_products WHERE bundle_id = ?', [bundleId]);
      for (const [index, productId] of data.productIds.entries()) {
        await connection.execute('INSERT INTO bundle_products (bundle_id, product_id, sort_order) VALUES (?, ?, ?)', [bundleId, productId, index + 1]);
      }
    }
    const [afterRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    await insertAdminAuditLog(connection, {
      req,
      action: data.isActive ? 'BUNDLE_ACTIVATE' : 'BUNDLE_UPDATE',
      entityType: 'bundle',
      entityId: bundleId,
      before: beforeRows[0],
      after: { ...afterRows[0], productIds: data.productIds },
      reason: 'Bundle updated',
    });
  });
  clearCommerceIntelligenceCache();
  return { ok: true as const, bundleId };
};

export const setBundleActive = async (req: AuthRequest, bundleId: number, isActive: boolean) => {
  await withDbTransaction(async (connection) => {
    const [beforeRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    if (!beforeRows[0]) throw new Error('BUNDLE_NOT_FOUND');
    await connection.execute('UPDATE bundles SET is_active = ?, updated_by = ?, updated_at = NOW() WHERE id = ?', [isActive ? 1 : 0, req.user?.email || req.user?.id || null, bundleId]);
    const [afterRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    await insertAdminAuditLog(connection, {
      req,
      action: isActive ? 'BUNDLE_ACTIVATE' : 'BUNDLE_DEACTIVATE',
      entityType: 'bundle',
      entityId: bundleId,
      before: beforeRows[0],
      after: afterRows[0],
      reason: isActive ? 'Bundle activated' : 'Bundle deactivated',
    });
  });
  clearCommerceIntelligenceCache();
  return { ok: true as const };
};

export const archiveBundle = async (req: AuthRequest, bundleId: number, reason = 'Bundle deleted by admin') => {
  await withDbTransaction(async (connection) => {
    const actor = req.user?.email || req.user?.id || null;
    const [beforeRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    if (!beforeRows[0]) throw new Error('BUNDLE_NOT_FOUND');
    await connection.execute(
      'UPDATE bundles SET is_active = 0, archived_at = NOW(), archived_by = ?, archive_reason = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [actor, String(reason || 'Bundle deleted by admin').trim().slice(0, 255), actor, bundleId]
    );
    const [afterRows]: any = await connection.execute('SELECT * FROM bundles WHERE id = ? LIMIT 1', [bundleId]);
    await insertAdminAuditLog(connection, {
      req,
      action: 'BUNDLE_DELETE',
      entityType: 'bundle',
      entityId: bundleId,
      before: beforeRows[0],
      after: afterRows[0],
      reason: 'Bundle deleted',
    });
  });
  clearCommerceIntelligenceCache();
  return { ok: true as const };
};
