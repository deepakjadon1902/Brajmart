import { PoolConnection } from 'mysql2/promise';
import { PricedOrderItem } from './orderPricing';

type InventoryRow = {
  id: number;
  name: string;
  stock_quantity: number | null;
  reserved_quantity: number | null;
  in_stock: number | boolean;
};

const asInt = (value: unknown, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const normalizeItems = (items: PricedOrderItem[]) => {
  const byProduct = new Map<string, { productId: string; name: string; quantity: number }>();
  for (const item of items || []) {
    const productId = String(item.productId || '').trim();
    if (!productId) continue;
    const existing = byProduct.get(productId);
    const quantity = asInt(item.quantity, 0);
    byProduct.set(productId, {
      productId,
      name: item.name,
      quantity: (existing?.quantity || 0) + quantity,
    });
  }
  return Array.from(byProduct.values()).filter((item) => item.quantity > 0);
};

const readInventoryForUpdate = async (connection: PoolConnection, productId: string) => {
  const [rows] = await connection.query(
    'SELECT id, name, stock_quantity, reserved_quantity, in_stock FROM products WHERE id = ? FOR UPDATE',
    [productId]
  );
  return (rows as InventoryRow[])[0] || null;
};

const writeInventoryTransaction = async (
  connection: PoolConnection,
  input: {
    productId: string;
    orderId: number;
    type: 'RESERVE' | 'RELEASE' | 'SALE';
    quantity: number;
    previousQuantity: number | null;
    newQuantity: number | null;
    previousReserved: number | null;
    newReserved: number | null;
    reason: string;
  }
) => {
  await connection.execute(
    `INSERT INTO inventory_transactions
      (product_id, order_id, type, quantity, previous_quantity, new_quantity, previous_reserved, new_reserved, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.productId,
      input.orderId,
      input.type,
      input.quantity,
      input.previousQuantity,
      input.newQuantity,
      input.previousReserved,
      input.newReserved,
      input.reason,
    ]
  );
};

const hasInventoryTransaction = async (
  connection: PoolConnection,
  orderId: number,
  productId: string,
  type: 'RESERVE' | 'RELEASE' | 'SALE'
) => {
  const [rows] = await connection.query(
    'SELECT id FROM inventory_transactions WHERE order_id = ? AND product_id = ? AND type = ? LIMIT 1',
    [orderId, productId, type]
  );
  return (rows as Array<{ id: number }>).length > 0;
};

export const reserveInventoryForOrder = async (
  connection: PoolConnection,
  orderId: number,
  items: PricedOrderItem[]
) => {
  for (const item of normalizeItems(items)) {
    const row = await readInventoryForUpdate(connection, item.productId);
    if (!row) throw new Error(`Inventory not found for ${item.name}`);
    if (row.stock_quantity === null || row.stock_quantity === undefined) continue;
    if (await hasInventoryTransaction(connection, orderId, item.productId, 'RESERVE')) continue;

    const stock = asInt(row.stock_quantity, 0);
    const reserved = asInt(row.reserved_quantity, 0);
    const available = stock - reserved;
    if (available < item.quantity) {
      throw new Error(`Only ${Math.max(0, available)} available for ${row.name}`);
    }

    const nextReserved = reserved + item.quantity;
    await connection.execute(
      'UPDATE products SET reserved_quantity = ?, in_stock = IF(stock_quantity - ? > 0, 1, 0), updated_at = NOW() WHERE id = ?',
      [nextReserved, nextReserved, item.productId]
    );
    await writeInventoryTransaction(connection, {
      productId: item.productId,
      orderId,
      type: 'RESERVE',
      quantity: item.quantity,
      previousQuantity: stock,
      newQuantity: stock,
      previousReserved: reserved,
      newReserved: nextReserved,
      reason: 'Reserved during checkout',
    });
  }
};

export const releaseInventoryForOrder = async (
  connection: PoolConnection,
  orderId: number,
  items: PricedOrderItem[]
) => {
  for (const item of normalizeItems(items)) {
    const row = await readInventoryForUpdate(connection, item.productId);
    if (!row || row.stock_quantity === null || row.stock_quantity === undefined) continue;
    if (await hasInventoryTransaction(connection, orderId, item.productId, 'SALE')) continue;
    if (await hasInventoryTransaction(connection, orderId, item.productId, 'RELEASE')) continue;

    const stock = asInt(row.stock_quantity, 0);
    const reserved = asInt(row.reserved_quantity, 0);
    const nextReserved = Math.max(0, reserved - item.quantity);
    await connection.execute(
      'UPDATE products SET reserved_quantity = ?, in_stock = IF(stock_quantity - ? > 0, 1, 0), updated_at = NOW() WHERE id = ?',
      [nextReserved, nextReserved, item.productId]
    );
    await writeInventoryTransaction(connection, {
      productId: item.productId,
      orderId,
      type: 'RELEASE',
      quantity: item.quantity,
      previousQuantity: stock,
      newQuantity: stock,
      previousReserved: reserved,
      newReserved: nextReserved,
      reason: 'Released checkout reservation',
    });
  }
};

export const convertReservationToSale = async (
  connection: PoolConnection,
  orderId: number,
  items: PricedOrderItem[]
) => {
  for (const item of normalizeItems(items)) {
    const row = await readInventoryForUpdate(connection, item.productId);
    if (!row || row.stock_quantity === null || row.stock_quantity === undefined) continue;
    if (await hasInventoryTransaction(connection, orderId, item.productId, 'SALE')) continue;

    const stock = asInt(row.stock_quantity, 0);
    const reserved = asInt(row.reserved_quantity, 0);
    const reservationWasReleased = await hasInventoryTransaction(connection, orderId, item.productId, 'RELEASE');
    const available = reservationWasReleased ? stock - reserved : stock;
    if (available < item.quantity) throw new Error(`Insufficient stock for ${row.name}`);
    if (stock < item.quantity) throw new Error(`Insufficient stock for ${row.name}`);
    const nextStock = stock - item.quantity;
    const nextReserved = Math.max(0, reserved - item.quantity);
    await connection.execute(
      'UPDATE products SET stock_quantity = ?, reserved_quantity = ?, in_stock = IF(? - ? > 0, 1, 0), sold_count = sold_count + ?, updated_at = NOW() WHERE id = ?',
      [nextStock, nextReserved, nextStock, nextReserved, item.quantity, item.productId]
    );
    await writeInventoryTransaction(connection, {
      productId: item.productId,
      orderId,
      type: 'SALE',
      quantity: item.quantity,
      previousQuantity: stock,
      newQuantity: nextStock,
      previousReserved: reserved,
      newReserved: nextReserved,
      reason: 'Converted reservation to sale',
    });
  }
};
