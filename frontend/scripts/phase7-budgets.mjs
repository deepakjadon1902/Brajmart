import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', dist));
const files = await readdir(new URL('assets/', dist));
const assets = await Promise.all(files.map(async (name) => ({
  name,
  bytes: (await stat(new URL(`assets/${name}`, dist))).size,
})));
const mainJs = assets.filter((asset) => /^index-.*\.js$/.test(asset.name)).sort((a, b) => b.bytes - a.bytes)[0];
const css = assets.filter((asset) => asset.name.endsWith('.css')).reduce((sum, asset) => sum + asset.bytes, 0);
const cartChunk = assets.find((asset) => asset.name.startsWith('CartDrawer-'));
const source = html.toString();
const domEstimate = (source.match(/<[^!/][^>]*>/g) || []).length;
const cardCount = (source.match(/class="[^"]*product-card/g) || []).length;

const budgets = {
  mainJsRawBytes: 285_000,
  totalCssRawBytes: 155_000,
  cartChunkRawBytes: 8_000,
  homepageHtmlGzipBytes: 60_000,
  homepagePrerenderedProductCards: 90,
  homepagePrerenderedDomEstimate: 4_500,
};
const actual = {
  mainJsRawBytes: mainJs?.bytes || 0,
  totalCssRawBytes: css,
  cartChunkRawBytes: cartChunk?.bytes || 0,
  homepageHtmlGzipBytes: gzipSync(html).length,
  homepagePrerenderedProductCards: cardCount,
  homepagePrerenderedDomEstimate: domEstimate,
};
const failures = Object.entries(budgets)
  .filter(([key, limit]) => actual[key] > limit)
  .map(([key, limit]) => `${key}: ${actual[key]} > ${limit}`);

console.log(JSON.stringify({ budgets, actual, failures }, null, 2));
if (failures.length) process.exitCode = 1;
