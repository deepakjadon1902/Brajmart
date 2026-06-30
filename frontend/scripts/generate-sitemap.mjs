import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getBuildData, SITE_URL, slugify } from './build-data.mjs';

const publicDir = path.resolve(process.cwd(), 'public');
const distDir = path.resolve(process.cwd(), 'dist');
const data = await getBuildData();

let fallbackPaths = [];
if (!data.live) {
  try {
    const candidates = await Promise.all(['sitemap.xml', 'sitemap-products.xml', 'sitemap-categories.xml', 'sitemap-blog.xml']
      .map((name) => fs.readFile(path.join(publicDir, name), 'utf8').catch(() => '')));
    let existing = candidates.join('\n');
    if (!existing.includes('/product/')) {
      try {
        existing += execFileSync('git', ['show', 'HEAD:frontend/public/sitemap.xml'], { encoding: 'utf8' });
      } catch {
        // Git history is only a local fallback; production always requires live API data.
      }
    }
    fallbackPaths = [...existing.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]).pathname.replace(/\/$/, '') || '/');
    console.warn('Using existing sitemap paths for local split-sitemap generation; Vercel production builds require live API data.');
  } catch {
    fallbackPaths = [];
  }
}

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const validDate = (value, fallback = data.generatedAt) => {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
};

const urlset = (entries) => {
  const seen = new Set();
  const urls = entries.filter((entry) => {
    if (!entry.path || entry.path.includes('?') || seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  }).map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}${entry.path === '/' ? '/' : entry.path}`)}</loc>`,
    `    <lastmod>${escapeXml(validDate(entry.lastmod))}</lastmod>`,
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
    entry.priority ? `    <priority>${entry.priority}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const pages = [
  '/', '/products', '/categories', '/about', '/contact', '/blog', '/help-center',
  '/customer-service', '/shipping-delivery', '/return-policy', '/privacy-policy',
  '/payment-method', '/terms',
  ...['vrindavan', 'mathura', 'govardhan', 'nandgaon', 'barsana', 'gokul'].map((slug) => `/braj-darshan/${slug}`),
].map((pagePath) => ({ path: pagePath, lastmod: data.generatedAt, changefreq: pagePath === '/' ? 'daily' : 'monthly', priority: pagePath === '/' ? '1.0' : '0.6' }));

const products = (data.live ? data.products.map((product) => ({
  path: `/product/${slugify(product.slug || product.name)}`,
  lastmod: product.updatedAt || product.updated_at || product.createdAt,
  changefreq: 'weekly',
  priority: '0.8',
})) : fallbackPaths.filter((item) => item.startsWith('/product/')).map((item) => ({ path: item, lastmod: data.generatedAt, changefreq: 'weekly', priority: '0.8' })))
  .filter((entry) => !entry.path.endsWith('/'));

const categories = (data.live ? data.categories.flatMap((category) => {
  const categorySlug = slugify(category.name);
  if (!categorySlug) return [];
  return [
    { path: `/category/${categorySlug}`, lastmod: category.updatedAt || category.updated_at, changefreq: 'weekly', priority: '0.8' },
    ...(category.subcategories || []).map((subcategory) => ({
      path: `/category/${categorySlug}/${slugify(subcategory.name)}`,
      lastmod: subcategory.updatedAt || subcategory.updated_at || category.updatedAt,
      changefreq: 'weekly',
      priority: '0.7',
    })).filter((entry) => !entry.path.endsWith('/')),
  ];
}) : fallbackPaths.filter((item) => item.startsWith('/category/')).map((item) => ({ path: item, lastmod: data.generatedAt, changefreq: 'weekly', priority: '0.8' })));

const blogs = (data.live ? data.blogs.map((post) => ({
  path: `/blog/${slugify(post.slug)}`,
  lastmod: post.updatedAt || post.publishedAt || post.createdAt,
  changefreq: 'monthly',
  priority: '0.6',
})) : fallbackPaths.filter((item) => item.startsWith('/blog/')).map((item) => ({ path: item, lastmod: data.generatedAt, changefreq: 'monthly', priority: '0.6' })))
  .filter((entry) => !entry.path.endsWith('/'));

const sitemapNames = ['sitemap-products.xml', 'sitemap-categories.xml', 'sitemap-pages.xml', 'sitemap-blog.xml'];
const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapNames.map((name) => `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}/${name}`)}</loc>\n    <lastmod>${escapeXml(validDate(data.generatedAt))}</lastmod>\n  </sitemap>`).join('\n')}\n</sitemapindex>\n`;

const outputs = {
  'sitemap-products.xml': urlset(products),
  'sitemap-categories.xml': urlset(categories),
  'sitemap-pages.xml': urlset(pages),
  'sitemap-blog.xml': urlset(blogs),
  'sitemap-index.xml': index,
  'sitemap_index.xml': index,
  'sitemap.xml': index,
};

await Promise.all([publicDir, distDir].flatMap((directory) =>
  Object.entries(outputs).map(async ([name, content]) => {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, name), content);
  })
));

console.log(`Generated split sitemaps: ${products.length} products, ${categories.length} categories/subcategories, ${pages.length} pages, ${blogs.length} blogs.`);
