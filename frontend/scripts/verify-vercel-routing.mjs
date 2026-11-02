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
assert.ok(config.headers.some((entry) => entry.source.includes('robots.txt') && entry.source.includes('sitemap.xml')));
assert.ok(config.redirects.length > 0, 'Existing redirects must remain present');
assert.ok(!config.rewrites.some((rule) => rule.source === '/(.*)' || rule.source === '/api/(.*)'));

console.log('Vercel SPA, SEO, static asset, and redirect routing checks passed.');
