import express from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import payuRoutes from './routes/payu';
import cartRoutes from './routes/cart';
import heroSlidesRoutes from './routes/heroSlides';
import blogRoutes from './routes/blogs';
import { isDbConnected, dbQuery } from './lib/db';

const app = express();
const SITE_URL = (process.env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const toPositiveInt = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 4096) : fallback;
};

app.get('/uploads/:filename', async (req, res, next) => {
  const width = toPositiveInt(req.query.width, 0);
  const height = toPositiveInt(req.query.height, 0);
  const quality = toPositiveInt(req.query.quality ?? req.query.q, 78);
  const fitRaw = String(req.query.fit || '').toLowerCase();
  const fit = fitRaw === 'contain' ? 'contain' : 'cover';
  const wantsResize = width > 0 || height > 0 || req.query.format || req.query.fmt;

  if (!wantsResize) return next();

  const filename = path.basename(String(req.params.filename || ''));
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  try {
    let image = sharp(filePath, { failOn: 'none' });
    if (width > 0 || height > 0) {
      image = image.resize({
        width: width > 0 ? width : undefined,
        height: height > 0 ? height : undefined,
        fit,
        withoutEnlargement: true,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/webp');
    const stream = image.webp({ quality: Math.max(35, Math.min(quality, 85)) }).pipe(res);
    stream.on?.('error', (err: any) => {
      if (!res.headersSent) res.status(500).end(err?.message || 'Image processing failed');
    });
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Image processing failed');
  }
});

app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const normalizeLegacySlug = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const legacyProductTagRedirects: Record<string, string> = {
  'best-selling-product': 'bestseller',
  'best-selling-products': 'bestseller',
  'best-seller': 'bestseller',
  'best-sellers': 'bestseller',
  bestseller: 'bestseller',
  latest: 'latest',
  'latest-product': 'latest',
  'latest-products': 'latest',
  'new-arrival': 'new',
  'new-arrivals': 'new',
  new: 'new',
  accessories: 'accessories',
  prasadam: 'prasadam',
  exclusive: 'exclusive',
};

app.get(['/product-tag/:slug', '/product-tag/:slug/'], (req, res) => {
  const tag = legacyProductTagRedirects[normalizeLegacySlug(req.params.slug)];
  res.redirect(301, tag ? `/products?tag=${encodeURIComponent(tag)}` : '/products');
});

app.get(['/product-category/:slug', '/product-category/:slug/'], (req, res) => {
  const slug = normalizeLegacySlug(req.params.slug);
  res.redirect(301, slug ? `/category/${slug}` : '/categories');
});

app.get(['/product-category/:slug/:subSlug', '/product-category/:slug/:subSlug/'], (req, res) => {
  const slug = normalizeLegacySlug(req.params.slug);
  const subSlug = normalizeLegacySlug(req.params.subSlug);
  res.redirect(301, slug && subSlug ? `/category/${slug}/${subSlug}` : slug ? `/category/${slug}` : '/categories');
});

app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payu', payuRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/hero-slides', heroSlidesRoutes);
app.use('/api/blogs', blogRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const xmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const slugify = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const toLastmod = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

type SitemapEntry = {
  path: string;
  priority: string;
  changefreq: string;
  lastmod?: string | null;
};

const staticSitemapEntries: SitemapEntry[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/products', priority: '0.9', changefreq: 'daily' },
  { path: '/products?tag=bestseller', priority: '0.8', changefreq: 'daily' },
  { path: '/products?tag=latest', priority: '0.8', changefreq: 'daily' },
  { path: '/products?tag=new', priority: '0.8', changefreq: 'daily' },
  { path: '/products?tag=prasadam', priority: '0.8', changefreq: 'weekly' },
  { path: '/products?tag=accessories', priority: '0.8', changefreq: 'weekly' },
  { path: '/products?tag=exclusive', priority: '0.8', changefreq: 'weekly' },
  { path: '/categories', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/spiritual-books', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/prasadam', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/idols-shringar', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/incense-pooja', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/incense-pooja-items', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/accessories', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/clothing', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/groceries', priority: '0.8', changefreq: 'weekly' },
  { path: '/category/braj-yatra', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', priority: '0.6', changefreq: 'weekly' },
  { path: '/braj-darshan/vrindavan', priority: '0.7', changefreq: 'monthly' },
  { path: '/braj-darshan/mathura', priority: '0.7', changefreq: 'monthly' },
  { path: '/braj-darshan/govardhan', priority: '0.7', changefreq: 'monthly' },
  { path: '/braj-darshan/nandgaon', priority: '0.7', changefreq: 'monthly' },
  { path: '/braj-darshan/barsana', priority: '0.7', changefreq: 'monthly' },
  { path: '/braj-darshan/gokul', priority: '0.7', changefreq: 'monthly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/help-center', priority: '0.5', changefreq: 'monthly' },
  { path: '/customer-service', priority: '0.5', changefreq: 'monthly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/shipping-delivery', priority: '0.3', changefreq: 'yearly' },
  { path: '/return-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/payment-method', priority: '0.3', changefreq: 'yearly' },
];

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: Twitterbot',
    'Allow: /',
    '',
    'User-agent: facebookexternalhit',
    'Allow: /',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Sitemap: ${SITE_URL}/sitemap_index.xml`,
  ].join('\n'));
});

app.get('/sitemap_index.xml', (_req, res) => {
  res
    .type('application/xml')
    .setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    .send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <sitemap>',
      `    <loc>${xmlEscape(`${SITE_URL}/sitemap.xml`)}</loc>`,
      '  </sitemap>',
      '</sitemapindex>',
    ].join('\n'));
});

app.get('/sitemap.xml', async (_req, res) => {
  const entries: SitemapEntry[] = [...staticSitemapEntries];

  if (isDbConnected()) {
    try {
      const [products, categories, subcategories, blogs] = await Promise.all([
        dbQuery<any>('SELECT slug, updated_at FROM products WHERE slug IS NOT NULL AND slug <> "" ORDER BY updated_at DESC'),
        dbQuery<any>('SELECT id, name, product_count, updated_at FROM categories WHERE name IS NOT NULL AND name <> "" ORDER BY updated_at DESC'),
        dbQuery<any>('SELECT s.name, s.updated_at, c.name AS category_name FROM subcategories s JOIN categories c ON s.category_id = c.id WHERE s.name IS NOT NULL AND s.name <> "" AND c.name IS NOT NULL AND c.name <> "" ORDER BY s.updated_at DESC').catch(() => []),
        dbQuery<any>("SELECT slug, updated_at FROM blogs WHERE slug IS NOT NULL AND slug <> '' AND status = 'published' ORDER BY updated_at DESC").catch(() => []),
      ]);

      for (const row of categories || []) {
        const slug = slugify(row.name);
        if (slug) entries.push({ path: `/category/${slug}`, priority: '0.8', changefreq: 'weekly', lastmod: row.updated_at });
      }
      for (const row of subcategories || []) {
        const slug = slugify(row.category_name);
        const subSlug = slugify(row.name);
        if (slug && subSlug) entries.push({ path: `/category/${slug}/${subSlug}`, priority: '0.7', changefreq: 'weekly', lastmod: row.updated_at });
      }
      for (const row of products || []) {
        const slug = slugify(row.slug);
        if (slug) entries.push({ path: `/product/${slug}`, priority: '0.7', changefreq: 'weekly', lastmod: row.updated_at });
      }
      for (const row of blogs || []) {
        const slug = slugify(row.slug);
        if (slug) entries.push({ path: `/blog/${slug}`, priority: '0.5', changefreq: 'monthly', lastmod: row.updated_at });
      }
    } catch (err) {
      console.error('Failed to build dynamic sitemap:', err);
    }
  }

  const seen = new Set<string>();
  const urls = entries
    .filter((entry) => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    })
    .map((entry) => {
      const lastmodValue = toLastmod(entry.lastmod);
      const lastmod = lastmodValue ? `\n    <lastmod>${xmlEscape(lastmodValue)}</lastmod>` : '';
      return [
        '  <url>',
        `    <loc>${xmlEscape(`${SITE_URL}${entry.path}`)}</loc>${lastmod}`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  res
    .type('application/xml')
    .setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

export default app;
