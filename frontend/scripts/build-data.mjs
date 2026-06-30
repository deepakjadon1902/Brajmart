import fs from 'node:fs/promises';
import path from 'node:path';

const loadEnvFile = async (file) => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Optional environment file.
  }
};

await loadEnvFile(path.resolve(process.cwd(), '.env.local'));
await loadEnvFile(path.resolve(process.cwd(), '.env'));

export const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');

const configuredApi = [process.env.API_BASE_URL, process.env.VITE_API_BASE_URL, process.env.VITE_API_URL]
  .map((value) => String(value || '').trim())
  .find(Boolean);

const API_BASE = (() => {
  if (!configuredApi) return '';
  if (/^https?:\/\//i.test(configuredApi)) return configuredApi.replace(/\/$/, '');
  return `${SITE_URL}${configuredApi.startsWith('/') ? configuredApi : `/${configuredApi}`}`.replace(/\/$/, '');
})();

const apiUrl = (resource) => {
  if (!API_BASE) return '';
  return API_BASE.endsWith('/api') ? `${API_BASE}${resource}` : `${API_BASE}/api${resource}`;
};

const fetchJson = async (resource, fallback) => {
  const url = apiUrl(resource);
  if (!url) return fallback;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) throw new Error(`${url} did not return JSON`);
  return response.json();
};

const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export const getBuildData = async ({ strict = Boolean(process.env.VERCEL || process.env.CI) } = {}) => {
  let products = [];
  let categories = [];
  let blogs = [];
  let heroSlides = [];
  let settings = {};
  let live = false;
  let error = null;

  try {
    [products, categories, blogs, heroSlides, settings] = await Promise.all([
      fetchJson('/products', []),
      fetchJson('/categories', []),
      fetchJson('/blogs', []),
      fetchJson('/hero-slides', []).catch(() => []),
      fetchJson('/settings', {}).catch(() => ({})),
    ]);
    products = Array.isArray(products) ? products.map((product) => ({ ...product, id: String(product.id || product._id || '') })) : [];
    categories = Array.isArray(categories) ? categories.map((category) => ({
      ...category,
      id: String(category.id || category._id || ''),
      subcategories: Array.isArray(category.subcategories)
        ? category.subcategories.map((subcategory) => ({ ...subcategory, id: String(subcategory.id || subcategory._id || '') }))
        : [],
    })) : [];
    blogs = Array.isArray(blogs) ? blogs : [];
    heroSlides = Array.isArray(heroSlides) ? heroSlides : [];
    settings = settings && typeof settings === 'object' ? settings : {};
    live = products.length > 0 && categories.length > 0;
    if (!live) throw new Error('The public catalog API returned no products or categories');
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error(String(caught));
    if (strict) {
      throw new Error(`SEO build stopped to prevent publishing empty HTML: ${error.message}. Configure API_BASE_URL in Vercel.`);
    }
    console.warn(`SEO build is using limited local fallback data: ${error.message}`);
  }

  return {
    products,
    categories,
    blogs,
    heroSlides,
    settings,
    generatedAt: new Date().toISOString(),
    live,
    error,
    slugify,
  };
};

export { slugify };
