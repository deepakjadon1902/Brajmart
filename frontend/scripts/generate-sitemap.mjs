import fs from 'node:fs/promises';
import path from 'node:path';

const loadLocalEnv = async () => {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    try {
      const raw = await fs.readFile(path.resolve(process.cwd(), file), 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...rest] = trimmed.split('=');
        const name = key.trim();
        if (!name || process.env[name] !== undefined) continue;
        process.env[name] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      // Optional env file.
    }
  }
};

await loadLocalEnv();

const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');
const API_BASE_RAW = process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || '';
const API_BASE = (() => {
  const raw = String(API_BASE_RAW || SITE_URL).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `${SITE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`.replace(/\/$/, '');
})();
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const EXISTING_SITEMAP = path.join(PUBLIC_DIR, 'sitemap.xml');

const categoryEntries = [
  { path: '/category/brajmart-special', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/books', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/accessories', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/clothing', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/groceries', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/idols-shringar', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/incense-pooja-items', priority: '0.9', changefreq: 'weekly' },
  { path: '/category/prasadam', priority: '0.9', changefreq: 'weekly' },
];

const staticEntries = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  ...categoryEntries,
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog', priority: '0.6', changefreq: 'weekly' },
  { path: '/braj-darshan/vrindavan', priority: '0.8', changefreq: 'weekly' },
  { path: '/braj-darshan/mathura', priority: '0.8', changefreq: 'weekly' },
  { path: '/braj-darshan/govardhan', priority: '0.8', changefreq: 'weekly' },
  { path: '/braj-darshan/nandgaon', priority: '0.8', changefreq: 'weekly' },
  { path: '/braj-darshan/barsana', priority: '0.8', changefreq: 'weekly' },
  { path: '/braj-darshan/gokul', priority: '0.8', changefreq: 'weekly' },
];

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const slugify = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const normalizePath = (value) => {
  try {
    const url = new URL(value, SITE_URL);
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return '';
  }
};

const apiUrl = (resourcePath) => {
  if (!API_BASE) return '';
  if (API_BASE.endsWith('/api')) return `${API_BASE}${resourcePath}`;
  return `${API_BASE}/api${resourcePath}`;
};

const fetchJson = async (resourcePath) => {
  const url = apiUrl(resourcePath);
  if (!url) return [];
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

const toLastmod = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const hasUsefulText = (value, minLength = 20) => String(value ?? '').replace(/\s+/g, ' ').trim().length >= minLength;

const extractExistingPaths = async (prefix) => {
  try {
    const xml = await fs.readFile(EXISTING_SITEMAP, 'utf8');
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => normalizePath(match[1]))
      .filter((entryPath) => entryPath.startsWith(prefix) && !entryPath.includes('?'));
  } catch {
    return [];
  }
};

const buildSitemap = (entries) => {
  const seen = new Set();
  const urls = entries
    .filter((entry) => {
      const cleanPath = normalizePath(entry.path);
      if (!cleanPath || cleanPath.includes('?') || seen.has(cleanPath)) return false;
      seen.add(cleanPath);
      entry.path = cleanPath;
      return true;
    })
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
      return [
        '  <url>',
        `    <loc>${xmlEscape(`${SITE_URL}${entry.path === '/' ? '/' : entry.path}`)}</loc>${lastmod}`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const buildSitemapIndex = () =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${xmlEscape(`${SITE_URL}/sitemap.xml`)}</loc>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');

const entries = [...staticEntries];
let liveProductsLoaded = false;
let liveBlogsLoaded = false;

try {
  const [products, blogs] = await Promise.all([
    fetchJson('/products'),
    fetchJson('/blogs').catch(() => []),
  ]);

  for (const product of products) {
    const slug = slugify(product?.slug || product?.name);
    if (slug) {
      entries.push({
        path: `/product/${slug}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: toLastmod(product?.updatedAt || product?.updated_at),
      });
    }
  }
  liveProductsLoaded = products.length > 0;

  for (const blog of blogs) {
    const slug = slugify(blog?.slug);
    if (slug && hasUsefulText(blog?.title, 5) && hasUsefulText(blog?.excerpt || blog?.content, 30)) {
      entries.push({
        path: `/blog/${slug}`,
        priority: '0.5',
        changefreq: 'monthly',
        lastmod: toLastmod(blog?.updatedAt || blog?.updated_at),
      });
    }
  }
  liveBlogsLoaded = blogs.length > 0;
} catch (err) {
  console.warn(`Could not fetch live catalog for sitemap from ${API_BASE}: ${err?.message || err}`);
}

if (!liveProductsLoaded) {
  const existingProducts = await extractExistingPaths('/product/');
  for (const productPath of existingProducts) {
    entries.push({ path: productPath, priority: '0.8', changefreq: 'weekly' });
  }
}

if (!liveBlogsLoaded) {
  const existingBlogs = await extractExistingPaths('/blog/');
  for (const blogPath of existingBlogs) {
    entries.push({ path: blogPath, priority: '0.5', changefreq: 'monthly' });
  }
}

await fs.mkdir(PUBLIC_DIR, { recursive: true });
await fs.writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), buildSitemap(entries));
await fs.writeFile(path.join(PUBLIC_DIR, 'sitemap_index.xml'), buildSitemapIndex());

const productCount = entries.filter((entry) => normalizePath(entry.path).startsWith('/product/')).length;
console.log(`Generated sitemap.xml with ${new Set(entries.map((entry) => normalizePath(entry.path))).size} clean URLs (${productCount} product URLs).`);
