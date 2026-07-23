import { dbExecute, dbQuery, isDbConnected } from './db';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

const columnExists = async (table: string, column: string) => {
  const rows = await dbQuery<any>(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return Boolean(rows.length);
};

const ensureOrderPricingSchema = async () => {
  const MIGRATION_KEY = '2026-07-01_packaging_percentage_order_breakdown_v2_compat';
  if (await isMigrationDone(MIGRATION_KEY)) return;

  if (!(await columnExists('settings', 'packaging_rate'))) {
    if (await columnExists('settings', 'packaging_cost')) {
      await dbExecute('ALTER TABLE settings ADD COLUMN packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
      await dbExecute('UPDATE settings SET packaging_rate = packaging_cost');
    } else if (await columnExists('settings', 'tax_rate')) {
      await dbExecute('ALTER TABLE settings ADD COLUMN packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
      await dbExecute('UPDATE settings SET packaging_rate = tax_rate');
    } else {
      await dbExecute('ALTER TABLE settings ADD COLUMN packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
    }
  }
  if (!(await columnExists('settings', 'tax_rate'))) {
    await dbExecute('ALTER TABLE settings ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
    await dbExecute('UPDATE settings SET tax_rate = packaging_rate');
  }
  const settingsToggleColumns = [
    ['cod_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['upi_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['card_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ] as const;
  for (const [column, definition] of settingsToggleColumns) {
    if (!(await columnExists('settings', column))) {
      await dbExecute(`ALTER TABLE settings ADD COLUMN ${column} ${definition}`);
    }
  }

  const orderColumns = [
    ['items_subtotal', 'DECIMAL(10,2) NULL AFTER items'],
    ['packaging_amount', 'DECIMAL(10,2) NULL AFTER items_subtotal'],
    ['packaging_rate', 'DECIMAL(5,2) NULL AFTER packaging_amount'],
    ['shipping_amount', 'DECIMAL(10,2) NULL AFTER packaging_rate'],
  ] as const;
  for (const [column, definition] of orderColumns) {
    if (!(await columnExists('orders', column))) {
      await dbExecute(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
    }
  }

  await setMigrationDone(MIGRATION_KEY);
};

const ensureOrderCodSchema = async () => {
  const MIGRATION_KEY = '2026-07-23_order_cod_breakdown';
  if (await isMigrationDone(MIGRATION_KEY)) return;

  const orderColumns = [
    ['cod_amount', 'DECIMAL(10,2) NULL AFTER shipping_amount'],
    ['cod_available', 'TINYINT(1) NULL AFTER cod_amount'],
    ['cod_pincode', 'VARCHAR(10) NULL AFTER cod_available'],
    ['cod_message', 'TEXT NULL AFTER cod_pincode'],
  ] as const;
  for (const [column, definition] of orderColumns) {
    if (!(await columnExists('orders', column))) {
      await dbExecute(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
    }
  }

  await setMigrationDone(MIGRATION_KEY);
};

const ensureFreeShippingThresholdDefault = async () => {
  const MIGRATION_KEY = '2026-07-07_free_shipping_threshold_299';
  if (await isMigrationDone(MIGRATION_KEY)) return;

  await dbExecute(
    'UPDATE settings SET free_shipping_threshold = 299 WHERE free_shipping_threshold IS NULL OR free_shipping_threshold = 0 OR free_shipping_threshold = 499'
  );

  await setMigrationDone(MIGRATION_KEY);
};

const ensureCoreTables = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INT NOT NULL AUTO_INCREMENT,
      category_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_subcategories_category_id (category_id),
      UNIQUE KEY uq_subcategories_category_name (category_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const getCategoryIdByName = async (name: string): Promise<number | null> => {
  const rows = await dbQuery<any>(
    'SELECT id FROM categories WHERE LOWER(TRIM(name)) = ? LIMIT 1',
    [norm(name)]
  );
  const id = rows?.[0]?.id;
  return id ? Number(id) : null;
};

const getOrCreateSubcategory = async (categoryId: number, name: string): Promise<number> => {
  const existing = await dbQuery<any>(
    'SELECT id FROM subcategories WHERE category_id = ? AND LOWER(TRIM(name)) = ? LIMIT 1',
    [categoryId, norm(name)]
  );
  if (existing?.[0]?.id) return Number(existing[0].id);

  const inserted: any = await dbExecute(
    'INSERT INTO subcategories (category_id, name, display_order) VALUES (?, ?, ?)',
    [categoryId, name.trim(), 0]
  );
  return Number(inserted.insertId);
};

const setMigrationDone = async (key: string) => {
  await dbExecute(
    `CREATE TABLE IF NOT EXISTS app_migrations (
      id INT NOT NULL AUTO_INCREMENT,
      migration_key VARCHAR(190) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_app_migrations_key (migration_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
  await dbExecute('INSERT IGNORE INTO app_migrations (migration_key) VALUES (?)', [key]);
};

const isMigrationDone = async (key: string) => {
  await dbExecute(
    `CREATE TABLE IF NOT EXISTS app_migrations (
      id INT NOT NULL AUTO_INCREMENT,
      migration_key VARCHAR(190) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_app_migrations_key (migration_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
  const rows = await dbQuery<any>('SELECT migration_key FROM app_migrations WHERE migration_key = ? LIMIT 1', [key]);
  return Boolean(rows?.length);
};

export const runDataMigrations = async () => {
  if (!isDbConnected()) return;
  // Default: run safe idempotent data migrations.
  // Set RUN_DATA_MIGRATIONS=false to disable.
  if (String(process.env.RUN_DATA_MIGRATIONS || '').toLowerCase() === 'false') return;

  await ensureCoreTables();
  await ensureOrderPricingSchema();
  await ensureOrderCodSchema();
  await ensureFreeShippingThresholdDefault();
  await migrateDeityShringarIntoIdolsSubcategory();
};

// Converts the "Deity Shringar Collection" category into a subcategory under "Idols & Shringar",
// and moves its products accordingly. Idempotent.
const migrateDeityShringarIntoIdolsSubcategory = async () => {
  const MIGRATION_KEY = '2026-05-23_deity_shringar_as_subcategory_of_idols';
  if (await isMigrationDone(MIGRATION_KEY)) return;

  const parentName = 'Idols & Shringar';
  const childName = 'Deity Shringar Collection';

  const parentId = await getCategoryIdByName(parentName);
  const childCategoryId = await getCategoryIdByName(childName);
  if (!parentId || !childCategoryId) {
    // If the DB doesn't have these categories (yet), skip gracefully.
    return;
  }

  // Ensure subcategory exists under parent.
  const subcategoryId = await getOrCreateSubcategory(parentId, childName);

  // Move products:
  // - any product whose category_id points at the child category, or whose legacy category name matches it
  //   becomes category_id=parentId and subcategory_id=subcategoryId.
  await dbExecute(
    `UPDATE products
     SET category_id = ?, subcategory_id = ?, category = ?
     WHERE category_id = ? OR LOWER(TRIM(category)) = ?`,
    [parentId, subcategoryId, parentName, childCategoryId, norm(childName)]
  );

  // Keep categories.product_count consistent (best-effort).
  try {
    await dbExecute('UPDATE categories SET product_count = (SELECT COUNT(*) FROM products WHERE category_id = categories.id) WHERE id IN (?, ?)', [parentId, childCategoryId]);
  } catch {
    // ignore
  }

  // Remove the old category now that its products are moved (safe: only if no products remain).
  const remaining = await dbQuery<any>(
    'SELECT COUNT(*) AS c FROM products WHERE category_id = ? OR LOWER(TRIM(category)) = ?',
    [childCategoryId, norm(childName)]
  );
  const count = Number(remaining?.[0]?.c ?? 0);
  if (count === 0) {
    await dbExecute('DELETE FROM categories WHERE id = ?', [childCategoryId]);
  }

  await setMigrationDone(MIGRATION_KEY);
};
