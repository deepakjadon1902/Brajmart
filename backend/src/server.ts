import express from 'express';
import compression from 'compression';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

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

app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

type SitemapEntry = {
  path: string;
  priority: string;
  changefreq: string;
  lastmod?: string | null;
};

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  ].join('\n'));
});

app.get('/sitemap.xml', async (_req, res) => {
  const entries: SitemapEntry[] = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/shop', priority: '0.9', changefreq: 'daily' },
    { path: '/products', priority: '0.9', changefreq: 'daily' },
    { path: '/categories', priority: '0.8', changefreq: 'weekly' },
    { path: '/about', priority: '0.6', changefreq: 'monthly' },
    { path: '/contact', priority: '0.6', changefreq: 'monthly' },
    { path: '/blog', priority: '0.5', changefreq: 'weekly' },
  ];

  if (isDbConnected()) {
    try {
      const [products, categories, blogs] = await Promise.all([
        dbQuery<any>('SELECT slug, updated_at FROM products WHERE slug IS NOT NULL AND slug <> "" ORDER BY updated_at DESC'),
        dbQuery<any>('SELECT name, updated_at FROM categories WHERE name IS NOT NULL AND name <> "" ORDER BY updated_at DESC'),
        dbQuery<any>('SELECT slug, updated_at FROM blogs WHERE slug IS NOT NULL AND slug <> "" ORDER BY updated_at DESC').catch(() => []),
      ]);

      for (const row of categories || []) {
        const slug = slugify(row.name);
        if (slug) entries.push({ path: `/category/${slug}`, priority: '0.8', changefreq: 'weekly', lastmod: row.updated_at });
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
      const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(new Date(entry.lastmod).toISOString())}</lastmod>` : '';
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
