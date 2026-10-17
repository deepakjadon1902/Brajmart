import type { PoolConnection } from 'mysql2/promise';

const invalid = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };

export const normalizeHomePlacement = (data: any) => {
  if (data.home_position !== undefined && data.homePosition === undefined) data.homePosition = data.home_position;
  if (data.show_on_home !== undefined && data.showOnHome === undefined) data.showOnHome = data.show_on_home;
  if (data.homePosition !== undefined) {
    const raw = data.homePosition;
    const position = raw === null || raw === '' ? null : Number(raw);
    if (position !== null && (!['number', 'string'].includes(typeof raw) || !Number.isInteger(position) || position < 1 || position > 6)) invalid('Home position must be a whole number from 1 to 6, or Automatic.');
    data.homePosition = position;
    data.showOnHome = position !== null;
  } else if (data.showOnHome === false || data.showOnHome === 0) {
    data.homePosition = null;
  }
};

// Lock category rows in a consistent order before locking or moving products.
// Two admins choosing the same position therefore replace it in commit order.
export const lockHomeCategories = async (connection: PoolConnection, ids: unknown[]) => {
  const categoryIds = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  for (const id of categoryIds) await connection.execute('SELECT id FROM categories WHERE id = ? FOR UPDATE', [id]);
};

export const claimHomePosition = async (connection: PoolConnection, data: any, categoryId: number | null, productId?: string, existing?: any): Promise<string[]> => {
  const provided = data.homePosition !== undefined || data.showOnHome !== undefined;
  const moving = existing && Number(existing.category_id) !== Number(categoryId);
  if (!provided && !moving) return [];
  const selected = provided ? Boolean(data.showOnHome) : Boolean(existing?.show_on_home);
  let position = data.homePosition === undefined ? (selected ? existing?.home_position ?? null : null) : data.homePosition;
  if (!selected) {
    data.homePosition = null;
    data.showOnHome = false;
    return [];
  }
  if (!categoryId) return invalid('Choose an existing category before assigning a home position.');
  const [categories] = await connection.execute('SELECT id FROM categories WHERE id = ? AND archived_at IS NULL', [categoryId]);
  if (!(categories as any[]).length) return invalid('Choose an active category before assigning a home position.');
  const [rows] = await connection.execute('SELECT id, home_position FROM products WHERE category_id = ? AND archived_at IS NULL FOR UPDATE', [categoryId]);
  const others = (rows as any[]).filter((row) => String(row.id) !== String(productId));
  if (position === null) {
    const occupied = new Set(others.map((row) => Number(row.home_position)));
    position = [1, 2, 3, 4, 5, 6].find((value) => !occupied.has(value));
    if (!position) return invalid('All six home positions are selected. Choose a position to replace its current product.');
  }
  const replaced = others.filter((row) => Number(row.home_position) === Number(position)).map((row) => String(row.id));
  if (replaced.length) {
    await connection.execute('UPDATE products SET home_position = NULL, show_on_home = 0, updated_at = NOW() WHERE category_id = ? AND home_position = ? AND id <> ?', [categoryId, position, productId || 0]);
  }
  data.homePosition = Number(position);
  data.showOnHome = true;
  return replaced;
};
