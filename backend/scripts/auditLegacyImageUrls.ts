import dotenv from 'dotenv';
dotenv.config();

import { connectDb, dbQuery } from '../src/lib/db';

type Finding = {
  tableName: string;
  id: string | number;
  columnName: string;
  value: string;
};

const looksLegacy = (value: unknown) => {
  const text = String(value || '');
  return text.includes('localhost:') || text.includes('127.0.0.1:') || text.includes('/uploads/');
};

const scanSimpleColumn = async (
  tableName: string,
  columnName: string,
  idColumn = 'id'
): Promise<Finding[]> => {
  const rows = await dbQuery<any>(`SELECT ${idColumn} AS id, ${columnName} AS value FROM ${tableName}`);
  return rows
    .filter((row) => looksLegacy(row.value))
    .map((row) => ({
      tableName,
      id: row.id,
      columnName,
      value: String(row.value || ''),
    }));
};

const getExistingColumns = async (tableName: string, columns: string[]) => {
  const rows = await dbQuery<any>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${columns.map(() => '?').join(',')})`,
    [tableName, ...columns]
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '').toLowerCase()));
};

const run = async () => {
  await connectDb();

  const scanPlan: Record<string, string[]> = {
    settings: ['store_logo', 'favicon'],
    categories: ['icon'],
    hero_slides: ['image_url'],
    blogs: ['cover_image'],
    products: ['image', 'images', 'color_variants'],
  };

  const findings: Finding[] = [];
  for (const [tableName, columns] of Object.entries(scanPlan)) {
    const existing = await getExistingColumns(tableName, columns);
    for (const columnName of columns) {
      if (!existing.has(columnName.toLowerCase())) continue;
      findings.push(...await scanSimpleColumn(tableName, columnName));
    }
  }

  if (!findings.length) {
    console.log('No legacy localhost or /uploads image URLs found.');
    process.exit(0);
  }

  console.log(`Found ${findings.length} legacy image URL field(s):`);
  for (const finding of findings) {
    console.log([
      `${finding.tableName}.${finding.columnName}`,
      `id=${finding.id}`,
      finding.value,
    ].join(' | '));
  }
  process.exit(1);
};

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
