import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isStrictSeoBuild } from './build-data-policy.mjs';
import { slugify, validateSeoCatalog } from './catalog-validation.mjs';
import { sanitizeBuildDiagnostic } from './seo-diagnostics.mjs';

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

const configuredApi = ['BUILD_API_BASE_URL', 'API_BASE_URL', 'BACKEND_URL', 'VITE_API_URL', 'VITE_API_BASE_URL']
  .map((key) => ({ key, url: normalizeAbsoluteApiBase(process.env[key]) }))
  .find(({ url }) => Boolean(url));

const ignoredRelativeApi = [process.env.BUILD_API_BASE_URL, process.env.API_BASE_URL, process.env.VITE_API_URL, process.env.VITE_API_BASE_URL]
  .map((value) => String(value || '').trim())
  .find((value) => value && !/^https?:\/\//i.test(value));

const API_BASE = (() => {
  if (!configuredApi) return '';
  return configuredApi.url;
})();

const apiUrl = (resource) => {
  if (!API_BASE) return '';
  return API_BASE.endsWith('/api') ? `${API_BASE}${resource}` : `${API_BASE}/api${resource}`;
};

const FETCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.BUILD_API_TIMEOUT_MS || 12_000));
const FETCH_RETRIES = Math.max(0, Math.min(3, Number(process.env.BUILD_API_RETRIES ?? 1)));
// Vercel and Render can auto-deploy the same commit concurrently. Wait for the
// backend process and required catalog routes to become ready; /health can
// succeed on the previous deployment while its catalog still returns HTTP 500.
const configuredReadyTimeout = Number(process.env.BUILD_API_READY_TIMEOUT_MS ?? 90_000);
const API_READY_TIMEOUT_MS = Number.isFinite(configuredReadyTimeout)
  ? Math.max(1_000, Math.min(180_000, configuredReadyTimeout))
  : 90_000;

const sleep = (ms, signal) => delay(ms, undefined, { signal });

const waitForApiReady = async (meta, deadline) => {
  if (!API_BASE) return;

  const url = apiUrl('/health');
  const diagnosticUrl = sanitizeBuildDiagnostic(url);
  const startedAt = Date.now();
  let delayMs = 1_000;
  let attempts = 0;
  let lastFailure = 'no response';
  let lastStatusCode = null;
  let lastBytes = 0;

  while (Date.now() < deadline) {
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timeoutMs = Math.max(1, Math.min(FETCH_TIMEOUT_MS, deadline - attemptStartedAt));
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    attempts += 1;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      // Consume the small health response so the underlying connection can be reused.
      lastBytes = (await response.arrayBuffer()).byteLength;
      lastStatusCode = response.status;
      if (response.ok) {
        meta.requests.push({
          resource: '/health',
          url: diagnosticUrl,
          status: 'OK',
          statusCode: response.status,
          bytes: lastBytes,
          durationMs: Date.now() - startedAt,
          attempts,
          error: '',
        });
        clearTimeout(timeout);
        return;
      }

      lastFailure = `backend health endpoint returned HTTP ${response.status}`;
      // A wrong path/configuration will not be repaired by waiting for a restart.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(lastFailure);
      }
    } catch (caught) {
      lastFailure = sanitizeBuildDiagnostic(caught instanceof Error ? caught.message : 'backend health request failed');
      if (/returned HTTP 4\d\d/.test(lastFailure) && !/HTTP 429/.test(lastFailure)) {
        clearTimeout(timeout);
        meta.requests.push({
          resource: '/health', url: diagnosticUrl, status: 'FAILED', statusCode: lastStatusCode, bytes: lastBytes,
          durationMs: Date.now() - startedAt, attempts, error: lastFailure,
        });
        throw new Error(`Catalog backend readiness check failed: ${lastFailure}`);
      }
    } finally {
      clearTimeout(timeout);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(delayMs, remainingMs));
    delayMs = Math.min(delayMs * 2, 8_000);
  }

  meta.requests.push({
    resource: '/health', url: diagnosticUrl, status: 'FAILED', statusCode: lastStatusCode, bytes: lastBytes,
    durationMs: Date.now() - startedAt, attempts, error: lastFailure,
  });
  throw new Error(`Catalog backend did not become ready within ${API_READY_TIMEOUT_MS}ms (${lastFailure})`);
};

const fetchJson = async (resource, fallback, meta, { deadline = 0, signal } = {}) => {
  const url = apiUrl(resource);
  const record = {
    resource,
    url: sanitizeBuildDiagnostic(url),
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
      ? 'No absolute build API URL configured; relative API settings cannot be used during prerendering.'
      : 'No build API URL configured.';
    return fallback;
  }

  let lastError = null;
  while (true) {
    const started = Date.now();
    const controller = new AbortController();
    const timeoutMs = deadline ? Math.max(1, Math.min(FETCH_TIMEOUT_MS, deadline - started)) : FETCH_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    record.attempts += 1;
    record.statusCode = null;
    record.bytes = 0;
    let retryable = true;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal,
      });
      record.statusCode = response.status;
      retryable = response.ok || response.status === 429 || response.status >= 500;
      const text = await response.text();
      record.bytes = Buffer.byteLength(text);
      if (!response.ok) {
        let detail = '';
        try {
          const data = JSON.parse(text);
          if (typeof data?.message === 'string') detail = data.message.replace(/\s+/g, ' ').slice(0, 240);
        } catch {
          // Do not copy an HTML error document into deployment logs.
        }
        throw new Error(`Catalog API ${resource} returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      retryable = false;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) throw new Error(`Catalog API ${resource} did not return JSON`);
      let data;
      try {
        data = text ? JSON.parse(text) : fallback;
      } catch {
        throw new Error(`Catalog API ${resource} returned invalid JSON`);
      }
      record.status = 'OK';
      record.error = '';
      if (record.attempts > 1) console.log(`Catalog API ${resource} recovered after ${record.attempts} attempts.`);
      return data;
    } catch (caught) {
      lastError = new Error(sanitizeBuildDiagnostic(caught instanceof Error ? caught.message : String(caught)));
      record.status = 'FAILED';
      record.error = lastError.message;
      if (signal?.aborted || !retryable) break;
      if (deadline ? Date.now() >= deadline : record.attempts > FETCH_RETRIES) break;
    } finally {
      clearTimeout(timeout);
      record.durationMs += Date.now() - started;
    }
    const backoff = Math.min(250 * (2 ** Math.min(record.attempts - 1, 5)), 8_000);
    const retryDelay = deadline ? Math.min(backoff, deadline - Date.now()) : backoff;
    if (retryDelay <= 0) break;
    if (deadline && record.attempts === 1) {
      console.warn(`${record.error}. Waiting for the catalog during backend deployment (up to ${API_READY_TIMEOUT_MS}ms total).`);
    }
    await sleep(retryDelay, signal);
  }

  throw lastError || new Error(`${url} failed`);
};

export const getBuildData = async ({ strict = isStrictSeoBuild() } = {}) => {
  let products = [];
  let categories = [];
  let blogs = [];
  let heroSlides = [];
  let settings = {};
  let live = false;
  let error = null;
  const meta = {
    apiBase: sanitizeBuildDiagnostic(API_BASE),
    apiSource: configuredApi?.key || null,
    siteUrl: sanitizeBuildDiagnostic(SITE_URL),
    stage: 'catalog-fetch',
    ignoredRelativeApi: sanitizeBuildDiagnostic(ignoredRelativeApi || ''),
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

  const catalogRequests = new AbortController();
  const deadline = Date.now() + API_READY_TIMEOUT_MS;
  try {
    await waitForApiReady(meta, deadline);
    [products, categories, blogs, heroSlides, settings] = await Promise.all([
      fetchJson('/products?view=detail', [], meta, { deadline, signal: catalogRequests.signal }),
      fetchJson('/categories', [], meta, { deadline, signal: catalogRequests.signal }),
      fetchJson('/blogs', [], meta, { signal: catalogRequests.signal }),
      fetchJson('/hero-slides', [], meta, { signal: catalogRequests.signal }).catch(() => []),
      fetchJson('/settings', {}, meta, { signal: catalogRequests.signal }).catch(() => ({})),
    ]);
    meta.stage = 'catalog-validation';
    meta.validation = validateSeoCatalog({ products, categories, blogs });
    products = products.map((product) => ({ ...product, id: String(product.id || product._id || '') }));
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
    meta.stage = 'complete';
  } catch (caught) {
    error = new Error(sanitizeBuildDiagnostic(caught instanceof Error ? caught.message : String(caught)));
    if (strict) {
      const failure = new Error(`SEO catalog validation failed; release build stopped to prevent publishing incomplete catalog HTML: ${error.message}. Stage=${meta.stage}; API setting=${meta.apiSource || 'missing'}. Configure BUILD_API_BASE_URL or API_BASE_URL with an absolute backend API URL and repair the catalog API. A local-only fallback build requires SEO_STRICT_BUILD=false; Vercel and CI builds ignore that opt-out.`);
      failure.diagnostics = meta;
      throw failure;
    }
    console.warn(`LOCAL SEO FALLBACK OPT-OUT ACTIVE; this build is not release-ready. Limited fallback data is being used because the catalog API is unavailable: ${error.message}`);
  } finally {
    catalogRequests.abort();
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
