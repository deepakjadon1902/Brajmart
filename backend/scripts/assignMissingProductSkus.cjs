// Dry-run by default. --apply fills only blank SKUs and keeps existing codes.
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const apply = process.argv.includes('--apply');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME, port: Number(process.env.DB_PORT || 3306), connectTimeout: 10000,
  });
  try {
    if (apply) await connection.beginTransaction();
    const [products] = await connection.query(`SELECT id, sku FROM products ORDER BY id${apply ? ' FOR UPDATE' : ''}`);
    const used = new Set(products.map((product) => String(product.sku || '').trim().toUpperCase()).filter(Boolean));
    const plan = [];
    for (const product of products) {
      if (String(product.sku || '').trim()) continue;
      const base = `BM-${String(product.id).padStart(6, '0')}`;
      let sku = base;
      let suffix = 1;
      while (used.has(sku)) sku = `${base}-${suffix++}`;
      used.add(sku);
      plan.push({ id: String(product.id), sku });
    }
    if (apply) {
      for (const { id, sku } of plan) {
        const [result] = await connection.execute("UPDATE products SET sku = ? WHERE id = ? AND (sku IS NULL OR TRIM(sku) = '')", [sku, id]);
        if (result.affectedRows !== 1) throw new Error(`SKU changed while assigning product ${id}`);
      }
      const [after] = await connection.query('SELECT id, sku FROM products ORDER BY id');
      const afterById = new Map(after.map((product) => [String(product.id), product.sku]));
      for (const product of products.filter((product) => String(product.sku || '').trim())) {
        if (afterById.get(String(product.id)) !== product.sku) throw new Error('An existing SKU changed; rolling back');
      }
      for (const { id, sku } of plan) if (afterById.get(id) !== sku) throw new Error('Assigned SKU verification failed; rolling back');
      await connection.commit();
    }
    console.log(JSON.stringify({ applied: apply, assigned: apply ? plan.length : 0, missing: plan.length, preserved: products.length - plan.length, examples: plan.slice(0, 5) }));
  } catch (error) { if (apply) await connection.rollback(); throw error; }
  finally { await connection.end(); }
})().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
