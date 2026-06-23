import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import fs from 'fs';
import ImageKit from 'imagekit';
import path from 'path';
import sharp from 'sharp';
import { connectDb, dbExecute, dbQuery } from '../src/lib/db';

type Target = {
  tableName: string;
  columnName: string;
  idColumn?: string;
};

type Replacement = {
  tableName: string;
  columnName: string;
  id: string | number;
  oldValue: string;
  newValue: string;
};

const uploadsDir = path.resolve(__dirname, '..', 'uploads');
const imagekitConfig = {
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, ''),
};

const targets: Target[] = [
  { tableName: 'settings', columnName: 'store_logo' },
  { tableName: 'settings', columnName: 'favicon' },
  { tableName: 'categories', columnName: 'icon' },
  { tableName: 'hero_slides', columnName: 'image_url' },
  { tableName: 'blogs', columnName: 'cover_image' },
  { tableName: 'products', columnName: 'image' },
  { tableName: 'products', columnName: 'images' },
  { tableName: 'products', columnName: 'color_variants' },
];

const imagekit = new ImageKit(imagekitConfig);

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

const legacyFileNameFromUrl = (value: string) => {
  const match = value.match(/\/uploads\/([^?#"'\s]+)/);
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const isLegacyUrl = (value: unknown) => {
  const text = String(value || '');
  return text.includes('localhost:') || text.includes('127.0.0.1:') || text.includes('/uploads/');
};

const optimizeImageBuffer = async (buffer: Buffer) => {
  const maxWidth = Math.max(320, Number(process.env.IMAGEKIT_UPLOAD_MAX_WIDTH || 2000));
  const quality = Math.min(92, Math.max(45, Number(process.env.IMAGEKIT_UPLOAD_QUALITY || 82)));
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
};

const uploadFile = async (filePath: string, originalName: string) => {
  const source = fs.readFileSync(filePath);
  const optimized = await optimizeImageBuffer(source);
  const safeName = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || `image_${crypto.randomBytes(3).toString('hex')}`;

  const result = await imagekit.upload({
    file: optimized,
    fileName: `${safeName}.webp`,
    folder: process.env.IMAGEKIT_FOLDER || '/brajmart',
    useUniqueFileName: true,
    tags: ['brajmart', 'migrated', 'optimized'],
    responseFields: ['width', 'height', 'size', 'filePath'],
  });
  return result.url;
};

const replaceLegacyUrls = async (value: string, cache: Map<string, string>) => {
  let next = value;
  const matches = Array.from(value.matchAll(/(?:https?:\/\/(?:localhost|127\.0\.0\.1):\d+)?\/uploads\/([^?#"'\s,\\\]]+)/g));
  for (const match of matches) {
    const matchedUrl = match[0];
    const fileName = legacyFileNameFromUrl(matchedUrl);
    if (!fileName) continue;
    const filePath = path.join(uploadsDir, path.basename(fileName));
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing local file for ${matchedUrl}; skipped`);
      continue;
    }

    let imagekitUrl = cache.get(fileName);
    if (!imagekitUrl) {
      imagekitUrl = await uploadFile(filePath, fileName);
      cache.set(fileName, imagekitUrl);
    }
    next = next.split(matchedUrl).join(imagekitUrl);
  }
  return next;
};

const run = async () => {
  if (!imagekitConfig.publicKey || !imagekitConfig.privateKey || !imagekitConfig.urlEndpoint) {
    throw new Error('IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are required.');
  }

  await connectDb();
  const cache = new Map<string, string>();
  const replacements: Replacement[] = [];

  for (const target of targets) {
    const existing = await getExistingColumns(target.tableName, [target.columnName]);
    if (!existing.has(target.columnName.toLowerCase())) continue;

    const idColumn = target.idColumn || 'id';
    const rows = await dbQuery<any>(`SELECT ${idColumn} AS id, ${target.columnName} AS value FROM ${target.tableName}`);
    for (const row of rows) {
      const oldValue = String(row.value || '');
      if (!isLegacyUrl(oldValue)) continue;

      const newValue = await replaceLegacyUrls(oldValue, cache);
      if (newValue === oldValue) continue;

      await dbExecute(`UPDATE ${target.tableName} SET ${target.columnName} = ? WHERE ${idColumn} = ?`, [newValue, row.id]);
      replacements.push({
        tableName: target.tableName,
        columnName: target.columnName,
        id: row.id,
        oldValue,
        newValue,
      });
    }
  }

  if (!replacements.length) {
    console.log('No legacy image URLs were migrated.');
    process.exit(0);
  }

  console.log(`Migrated ${replacements.length} image URL field(s) to ImageKit:`);
  for (const item of replacements) {
    console.log(`${item.tableName}.${item.columnName} id=${item.id} -> ${item.newValue}`);
  }
  process.exit(0);
};

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
