import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const rewrite = (source) => config.rewrites.find((rule) => rule.source === source);

for (const route of ['/category/:slug', '/category/:slug/:subSlug', '/product/:slug', '/blog/:slug']) {
  assert.ok(rewrite(route), `SEO prerender rewrite ${route} must remain configured`);
}
for (const route of ['/admin', '/admin/(.*)', '/payment-status/(.*)', '/profile/(.*)']) {
  assert.equal(rewrite(route)?.destination, '/index.html', `${route} must continue to support direct navigation`);
}

assert.ok(config.headers.some((entry) => entry.source === '/assets/(.*)'));
const cacheHeader = (pathname) => config.headers
  .filter((entry) => new RegExp(`^${entry.source}$`).test(pathname))
  .flatMap((entry) => entry.headers)
  .filter((header) => header.key.toLowerCase() === 'cache-control');
for (const pathname of ['/', '/index.html', '/admin', '/admin/analytics', '/cart', '/product/test-product', '/product/test-product/index.html']) {
  assert.ok(cacheHeader(pathname).some((header) => header.value.includes('no-cache')), `${pathname} must revalidate HTML after deployments`);
}
assert.deepEqual(cacheHeader('/assets/AdminAnalytics-build.js').map((header) => header.value), ['public, max-age=31536000, immutable']);
assert.equal(cacheHeader('/api/products').length, 0, 'Document caching must not override API caching');
assert.ok(config.headers.some((entry) => entry.source.includes('robots.txt') && entry.source.includes('sitemap.xml')));
assert.ok(config.redirects.length > 0, 'Existing redirects must remain present');
assert.ok(!config.rewrites.some((rule) => rule.source === '/(.*)' || rule.source === '/api/(.*)'));
assert.equal(rewrite('/api/:path*')?.destination, 'https://brajmart-1.onrender.com/api/:path*', 'Relative browser API requests must reach Render');

console.log('Vercel SPA, SEO, static asset, and redirect routing checks passed.');
