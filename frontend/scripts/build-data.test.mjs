import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let importId = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const catalog = {
  '/api/health': { status: 'ok' },
  '/api/products': [{ id: 11, name: 'Tulsi Mala', slug: 'tulsi-mala' }],
  '/api/categories': [{ _id: 2, name: 'Accessories', subcategories: [{ _id: 7, name: 'Malas' }] }],
  '/api/blogs': [],
  '/api/hero-slides': [],
  '/api/settings': {},
};

const setup = async (handler, env = {}) => {
  Object.assign(process.env, {
    BUILD_API_BASE_URL: 'https://catalog-build.invalid/api',
    BUILD_API_RETRIES: '0',
    BUILD_API_READY_TIMEOUT_MS: '2000',
    VERCEL: '1',
    SEO_STRICT_BUILD: 'false',
    ...env,
  });
  const calls = new Map();
  globalThis.fetch = async (url, options) => {
    const resource = new URL(url).pathname;
    assert.ok(resource in catalog, `Unexpected request: ${resource}`);
    const attempt = (calls.get(resource) || 0) + 1;
    calls.set(resource, attempt);
    return await handler?.(resource, attempt, options) ?? json(catalog[resource]);
  };
  const { getBuildData } = await import(`./build-data.mjs?catalog-test=${++importId}`);
  return { getBuildData, calls };
};

test('a healthy old backend can fail catalog requests until the new deployment becomes ready', async () => {
  const { getBuildData, calls } = await setup((resource, attempt) => {
    if (resource === '/api/categories' && attempt < 3) return json({ message: 'Previous backend schema handler' }, 500);
    if (resource === '/api/products' && attempt < 2) return json({ message: 'Service restarting' }, 503);
  });
  const data = await getBuildData();
  assert.equal(calls.get('/api/health'), 1);
  assert.equal(calls.get('/api/categories'), 3);
  assert.equal(calls.get('/api/products'), 2);
  assert.equal(data.live, true);
  assert.equal(data.products[0].id, '11');
  assert.equal(data.categories[0].subcategories[0].id, '7');
  const categoryRequest = data.meta.requests.find(({ resource }) => resource === '/categories');
  assert.equal(categoryRequest.status, 'OK');
  assert.equal(categoryRequest.error, '');
});

test('a transient catalog network error is retried within the readiness window', async () => {
  const { getBuildData, calls } = await setup((resource, attempt) => {
    if (resource === '/api/categories' && attempt === 1) throw new TypeError('fetch failed');
  });
  assert.equal((await getBuildData()).live, true);
  assert.equal(calls.get('/api/categories'), 2);
});

test('an interrupted response body is retried instead of treating HTTP 200 as ready', async () => {
  const { getBuildData, calls } = await setup((resource, attempt) => {
    if (resource === '/api/categories' && attempt === 1) {
      return { ok: true, status: 200, text: async () => { throw new TypeError('Connection reset'); } };
    }
  });
  assert.equal((await getBuildData()).live, true);
  assert.equal(calls.get('/api/categories'), 2);
});

test('rate-limited catalog requests can recover during readiness checks', async () => {
  const { getBuildData, calls } = await setup((resource, attempt) => {
    if (resource === '/api/categories' && attempt === 1) return json({ message: 'Try again shortly' }, 429);
  });
  assert.equal((await getBuildData()).live, true);
  assert.equal(calls.get('/api/categories'), 2);
});

test('persistent catalog HTTP 500 fails the release with the backend error after the bounded wait', async () => {
  const { getBuildData, calls } = await setup((resource) => {
    if (resource === '/api/categories') return json({ message: 'Runtime database DDL is disabled' }, 500);
  }, { BUILD_API_READY_TIMEOUT_MS: '1000' });
  await assert.rejects(getBuildData(), /\/categories returned HTTP 500: Runtime database DDL is disabled/);
  assert.ok(calls.get('/api/categories') > 1);
});

test('configuration HTTP errors fail immediately and cancel pending catalog retries', async () => {
  let pendingSignal;
  const { getBuildData, calls } = await setup((resource, _attempt, options) => {
    if (resource === '/api/categories') return json({ message: 'Forbidden' }, 403);
    if (resource === '/api/products') {
      pendingSignal = options.signal;
      return json({ message: 'Service restarting' }, 503);
    }
  });
  await assert.rejects(getBuildData(), /\/categories returned HTTP 403: Forbidden/);
  assert.equal(calls.get('/api/categories'), 1);
  assert.equal(calls.get('/api/products'), 1);
  assert.equal(pendingSignal.aborted, true);
});

test('invalid catalog JSON and HTML responses fail without retrying', async () => {
  for (const [body, type, error] of [
    ['{broken', 'application/json', /\/categories returned invalid JSON/],
    ['<html>wrong API URL</html>', 'text/html', /\/categories did not return JSON/],
  ]) {
    const { getBuildData, calls } = await setup((resource) => {
      if (resource === '/api/categories') return new Response(body, { headers: { 'content-type': type } });
    });
    await assert.rejects(getBuildData(), error);
    assert.equal(calls.get('/api/categories'), 1);
  }
});

test('a successful response with an empty catalog still cannot publish a release', async () => {
  const { getBuildData } = await setup((resource) => {
    if (resource === '/api/categories') return json([]);
  });
  await assert.rejects(getBuildData(), /release build stopped.*no products or categories/);
});

test('HTTP failures identify the fetch stage rather than inventing a failing category entry', async () => {
  const { getBuildData } = await setup((resource) => {
    if (resource === '/api/categories') return json({ message: 'Forbidden' }, 403);
  });
  await assert.rejects(getBuildData(), error => {
    assert.match(error.message, /\/categories returned HTTP 403/);
    assert.equal(error.diagnostics.stage, 'catalog-fetch');
    assert.equal(error.diagnostics.apiSource, 'BUILD_API_BASE_URL');
    assert.ok(!error.message.includes('Invalid SEO catalog entry'));
    return true;
  });
});

test('malformed catalog responses identify the exact entry at the validation stage', async () => {
  const { getBuildData } = await setup((resource) => {
    if (resource === '/api/categories') return json([{ _id: 'broken-category', name: null }]);
  });
  await assert.rejects(getBuildData(), error => {
    assert.match(error.message, /categories\[0\] id="broken-category".*name must be a non-empty string/);
    assert.equal(error.diagnostics.stage, 'catalog-validation');
    return true;
  });
});

test('errors and diagnostic metadata do not expose API credentials or backend secrets', async () => {
  const { getBuildData } = await setup((resource) => {
    if (resource === '/api/categories') return json({ message: 'password=privatePass envSecret789 Bearer bearer123' }, 403);
  }, { BUILD_API_BASE_URL: 'https://user:privatePassword@catalog-build.invalid/api', TEST_SECRET: 'envSecret789' });
  await assert.rejects(getBuildData(), error => {
    const diagnostic = error.message + JSON.stringify(error.diagnostics);
    for (const secret of ['privatePassword', 'privatePass', 'envSecret789', 'bearer123', 'user:']) assert.ok(!diagnostic.includes(secret), secret);
    return true;
  });
});
