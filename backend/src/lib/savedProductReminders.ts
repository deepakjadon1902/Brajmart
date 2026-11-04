import { createHash } from 'crypto';
import { dbQuery, withDbTransaction } from './db';
import { parseJson } from './dbHelpers';

export const SAVED_PRODUCTS_CONSENT_VERSION = 'saved-products-v1';
export type SavedProductsSnapshot = { source: 'saved_products'; cartItems: any[]; favoriteItems: any[] };
export const savedProductsSnapshot = (raw: unknown): SavedProductsSnapshot | null => {
  const snapshot = parseJson<any>(raw, null);
  return snapshot?.source === 'saved_products' && Array.isArray(snapshot.cartItems) && Array.isArray(snapshot.favoriteItems)
    ? snapshot : null;
};
const list = (raw: unknown): any[] => { const parsed = parseJson<any>(raw, []); return Array.isArray(parsed) ? parsed : []; };
const productId = (raw: any) => String(raw?.productId || raw?.id || raw?._id || raw?.product?.id || raw?.product?._id || '').split('::')[0];
const money = (raw: unknown) => { const value = Number(raw); return raw != null && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null; };

// Treat browser snapshots as IDs/selections only. Names, SKUs, prices and stock
// come from the current catalog; archived and unavailable lines are omitted.
export const resolveSavedProducts = async (snapshot: SavedProductsSnapshot) => {
  const ids = [...new Set([...snapshot.cartItems, ...snapshot.favoriteItems].map(productId).filter(Boolean))];
  const products = ids.length ? await dbQuery<any>(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND archived_at IS NULL`, ids) : [];
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const resolve = (raw: any, favorite: boolean) => {
    const product = byId.get(productId(raw));
    if (!product || !Number(product.in_stock) || product.archived_at) return null;
    const original = raw?.product || raw || {};
    const selectedSize = raw?.selectedSize || original.selectedSize;
    const selectedPieces = raw?.selectedPieces || original.selectedPieces;
    const selections = raw?.selectedAttributes || raw?.selections || original.selectedAttributes || {};
    const attributes = Object.fromEntries(Object.entries(selections).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    const catalogAttributes = list(product.attributes);
    for (const [key, value] of Object.entries(attributes)) {
      const attribute = catalogAttributes.find((item) => item.slug === key);
      if (!attribute || !list(attribute.terms).map(String).includes(String(value))) return null;
    }
    const priceSelections: Record<string, string> = { ...attributes };
    const color = catalogAttributes.find((item) => /color/i.test(`${item.slug} ${item.name}`));
    if (color?.slug) delete priceSelections[color.slug];
    if (selectedSize) priceSelections.size = String(selectedSize);
    const piecesCount = Number(selectedPieces || 1);
    if (!Number.isInteger(piecesCount) || piecesCount < 1 || piecesCount > 120) return null;
    if (piecesCount > 1) priceSelections.pieces = String(piecesCount);
    let price = money(product.price);
    const variants = list(product.variant_pricing).sort((a, b) => Object.keys(b.selections || {}).length - Object.keys(a.selections || {}).length);
    const variant = variants.find((item) => Object.keys(item.selections || {}).length > 0
      && Object.entries(item.selections).every(([key, value]) => String(priceSelections[key] || '') === String(value)));
    if (variant) price = money(variant.price);
    if (selectedSize) {
      const sizes = list(product.size_pricing);
      const allowedSizes = list(product.sizes);
      if (allowedSizes.length && !allowedSizes.map(String).includes(String(selectedSize))) return null;
      const size = sizes.find((item) => String(item.size) === String(selectedSize));
      if (!allowedSizes.length && !size) return null;
      if (!variant && piecesCount === 1 && size) price = money(size.price);
    }
    if (!variant && piecesCount > 1) {
      const pieces = list(product.piece_pricing);
      const piece = pieces.find((item) => Number(item.pieces) === piecesCount);
      price = piece ? money(piece.price) : money(Number(product.price) * piecesCount);
    }
    const requested = favorite ? 1 : Number(raw?.quantity ?? 1);
    if (!price || !Number.isInteger(requested) || requested < 1 || requested > 120) return null;
    const available = product.stock_quantity == null ? requested : Math.max(0, Number(product.stock_quantity) - Number(product.reserved_quantity || 0));
    const quantity = Math.min(requested, available);
    if (!Number.isInteger(quantity) || quantity < 1) return null;
    return { productId: String(product.id), name: String(product.name), slug: String(product.slug || ''), sku: String(variant?.sku || product.sku || ''),
      image: String(product.image || ''), price, quantity, selectedSize, selectedPieces, selectedAttributes: attributes };
  };
  const cartItems = snapshot.cartItems.map((item) => resolve(item, false)).filter(Boolean);
  const cartIds = new Set(cartItems.map((item) => item!.productId));
  const favoriteIds = new Set<string>();
  const favoriteItems = snapshot.favoriteItems.map((item) => resolve(item, true)).filter((item) => {
    if (!item || cartIds.has(item.productId) || favoriteIds.has(item.productId)) return false;
    favoriteIds.add(item.productId);
    return true;
  });
  return { source: 'saved_products' as const, cartItems, favoriteItems };
};

export const loadAccountSavedProducts = async (userId: string | number, email: string) => {
  const rows = await dbQuery<any>(`SELECT c.items AS cart_items, w.items AS favorite_items FROM users u
    LEFT JOIN carts c ON c.user_id = u.id LEFT JOIN wishlists w ON w.user_id = u.id
    WHERE u.id = ? AND LOWER(u.email) = ? LIMIT 1`, [userId, email]);
  if (!rows[0]) return null;
  return { source: 'saved_products' as const, cartItems: list(rows[0].cart_items), favoriteItems: list(rows[0].favorite_items) };
};

// Cart/favorite writes queue a single combined reminder only for customers who
// explicitly requested this broader scope. Never enroll historical accounts.
export const scheduleAccountSavedProductsReminder = async (userId: string | number) => {
  await withDbTransaction(async (connection) => {
    const [rows] = await connection.execute(`SELECT p.email, p.customer_name FROM email_contact_preferences p JOIN users u ON u.id = p.user_id AND LOWER(u.email) = p.email
      WHERE u.id = ? AND p.cart_reminder_consent = 1 AND p.consent_version = ? LIMIT 1 FOR UPDATE`, [userId, SAVED_PRODUCTS_CONSENT_VERSION]);
    const contact = (rows as any[])[0];
    if (!contact) return;
    const [savedRows] = await connection.execute(`SELECT c.items AS cart_items, w.items AS favorite_items FROM users u
      LEFT JOIN carts c ON c.user_id = u.id LEFT JOIN wishlists w ON w.user_id = u.id WHERE u.id = ? LIMIT 1`, [userId]);
    const saved = (savedRows as any[])[0];
    if (!saved) return;
    const snapshot: SavedProductsSnapshot = { source: 'saved_products', cartItems: list(saved.cart_items), favoriteItems: list(saved.favorite_items) };
    const [activeJobs] = await connection.execute(`SELECT items, status FROM cart_reminder_jobs WHERE email = ? AND status IN ('pending', 'sending') FOR UPDATE`, [contact.email]);
    // An active checkout/payment reminder takes precedence over saved products.
    if ((activeJobs as any[]).some((job) => job.status === 'sending' || !savedProductsSnapshot(job.items))) return;
    const key = createHash('sha256').update(`saved-products:${contact.email}:${JSON.stringify(snapshot)}`).digest('hex');
    const [existing] = await connection.execute('SELECT id, status, attempts FROM cart_reminder_jobs WHERE idempotency_key = ? LIMIT 1', [key]);
    await connection.execute(`UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'Saved products changed', updated_at = NOW()
      WHERE email = ? AND status = 'pending' AND idempotency_key <> ? AND JSON_UNQUOTE(JSON_EXTRACT(items, '$.source')) = 'saved_products'`, [contact.email, key]);
    const previous = (existing as any[])[0];
    if (previous) {
      // Returning to a list that changed before its first send should re-arm
      // that reminder, while sent/uncertain outcomes remain deduplicated.
      if (previous.status === 'cancelled' && Number(previous.attempts) === 0 && (snapshot.cartItems.length || snapshot.favoriteItems.length)) {
        await connection.execute(`UPDATE cart_reminder_jobs SET status = 'pending', activity_at = NOW(), due_at = DATE_ADD(NOW(), INTERVAL 3 HOUR),
          last_error = NULL, updated_at = NOW() WHERE id = ? AND status = 'cancelled' AND attempts = 0`, [previous.id]);
      }
      return;
    }
    if (!snapshot.cartItems.length && !snapshot.favoriteItems.length) return;
    await connection.execute(`INSERT INTO cart_reminder_jobs (email, user_id, customer_name, items, items_subtotal, activity_at, due_at, status, idempotency_key)
      VALUES (?, ?, ?, ?, 0, NOW(), DATE_ADD(NOW(), INTERVAL 3 HOUR), 'pending', ?)`, [contact.email, userId, contact.customer_name, JSON.stringify(snapshot), key]);
  });
};
