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

const loadSelectedEnvFile = async (file, keys) => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!keys.has(key) || process.env[key] !== undefined) continue;
      process.env[key] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Optional environment file.
  }
};

await loadEnvFile(path.resolve(process.cwd(), '.env.local'));
await loadEnvFile(path.resolve(process.cwd(), '.env'));
await loadSelectedEnvFile(path.resolve(process.cwd(), '..', 'backend', '.env'), new Set(['BACKEND_URL']));

export const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');

const normalizeAbsoluteApiBase = (value) => {
  const raw = String(value || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return '';
  return raw.replace(/\/$/, '');
};

const configuredApi = [
  process.env.BUILD_API_BASE_URL,
  process.env.API_BASE_URL,
  process.env.BACKEND_URL,
  process.env.VITE_API_URL,
  process.env.VITE_API_BASE_URL,
]
  .map(normalizeAbsoluteApiBase)
  .find(Boolean);

const ignoredRelativeApi = [process.env.BUILD_API_BASE_URL, process.env.API_BASE_URL, process.env.VITE_API_URL, process.env.VITE_API_BASE_URL]
  .map((value) => String(value || '').trim())
  .find((value) => value && !/^https?:\/\//i.test(value));

const API_BASE = (() => {
  if (!configuredApi) return '';
  return configuredApi;
})();

const apiUrl = (resource) => {
  if (!API_BASE) return '';
  return API_BASE.endsWith('/api') ? `${API_BASE}${resource}` : `${API_BASE}/api${resource}`;
};

const FETCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.BUILD_API_TIMEOUT_MS || 12_000));
const FETCH_RETRIES = Math.max(0, Math.min(3, Number(process.env.BUILD_API_RETRIES ?? 1)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (resource, fallback, meta) => {
  const url = apiUrl(resource);
  const record = {
    resource,
    url,
    status: 'SKIPPED',
    statusCode: null,
    bytes: 0,
    durationMs: 0,
    attempts: 0,
    error: '',
  };
  meta.requests.push(record);
  if (!url) {
    record.error = ignoredRelativeApi
      ? `No absolute build API URL configured; ignored relative value "${ignoredRelativeApi}".`
      : 'No build API URL configured.';
    return fallback;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    record.attempts += 1;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();
      clearTimeout(timeout);
      record.durationMs += Date.now() - started;
      record.statusCode = response.status;
      record.bytes = Buffer.byteLength(text);
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error(`${url} did not return JSON`);
      record.status = 'OK';
      return text ? JSON.parse(text) : fallback;
    } catch (caught) {
      clearTimeout(timeout);
      record.durationMs += Date.now() - started;
      lastError = caught instanceof Error ? caught : new Error(String(caught));
      record.status = 'FAILED';
      record.error = lastError.message;
      if (attempt < FETCH_RETRIES) await sleep(250 * (attempt + 1));
    }
  }

  throw lastError || new Error(`${url} failed`);
};

const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const isStrictSeoBuild = () => String(process.env.SEO_STRICT_BUILD || '').toLowerCase() === 'true';

export const getBuildData = async ({ strict = isStrictSeoBuild() } = {}) => {
  let products = [];
  let categories = [];
  let blogs = [];
  let heroSlides = [];
  let settings = {};
  let live = false;
  let error = null;
  const meta = {
    apiBase: API_BASE,
    ignoredRelativeApi: ignoredRelativeApi || '',
    strict,
    timeoutMs: FETCH_TIMEOUT_MS,
    retries: FETCH_RETRIES,
    requests: [],
    counts: {
      products: 0,
      categories: 0,
      blogs: 0,
      heroSlides: 0,
      settings: 0,
    },
  };

  try {
    [products, categories, blogs, heroSlides, settings] = await Promise.all([
      fetchJson('/products?view=detail', [], meta),
      fetchJson('/categories', [], meta),
      fetchJson('/blogs', [], meta),
      fetchJson('/hero-slides', [], meta).catch(() => []),
      fetchJson('/settings', {}, meta).catch(() => ({})),
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
    meta.counts.products = products.length;
    meta.counts.categories = categories.length;
    meta.counts.blogs = blogs.length;
    meta.counts.heroSlides = heroSlides.length;
    meta.counts.settings = Object.keys(settings).length ? 1 : 0;
    live = products.length > 0 && categories.length > 0;
    if (!live) throw new Error('The public catalog API returned no products or categories');
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error(String(caught));
    if (strict) {
      throw new Error(`SEO strict build stopped to prevent publishing empty HTML: ${error.message}. Configure BUILD_API_BASE_URL or API_BASE_URL with an absolute backend API URL, or set SEO_STRICT_BUILD=false for an emergency deploy.`);
    }
    console.warn(`SEO build is using limited fallback data because the catalog API is unavailable: ${error.message}`);
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
    meta,
    slugify,
  };
};

export { slugify };
