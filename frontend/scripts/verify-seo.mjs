import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const route of ['', 'about', 'help-center', 'privacy-policy']) {
  const file = route ? path.join(dist, route, 'index.html') : path.join(dist, 'index.html');
  const html = await fs.readFile(file, 'utf8');
  assert(!html.includes('<div id="root"></div>'), `${route || '/'} still has an empty root`);
  assert(/<h1\b/i.test(html), `${route || '/'} has no server-rendered H1`);
  assert(/rel="canonical"/i.test(html), `${route || '/'} has no canonical`);
  assert(/application\/ld\+json/i.test(html), `${route || '/'} has no JSON-LD`);
}

const { render } = await import(`${pathToFileURL(path.join(root, 'dist-ssr/entry-server.js')).href}?verify=${Date.now()}`);
const product = {
  id: 'SKU-VERIFY-1', name: 'SEO Verification Prasadam', slug: 'seo-verification-prasadam',
  price: 199, originalPrice: 249, image: 'https://ik.imagekit.io/example/product.jpg', images: ['https://ik.imagekit.io/example/product.jpg'],
  category: 'Prasadam', subcategory: 'Temple Prasadam', description: 'Authentic temple prasadam prepared for devotees.',
  rating: 4.8, reviewCount: 12, inStock: true, tags: ['bestseller'],
};
const data = {
  products: [product, { ...product, id: 'SKU-VERIFY-2', name: 'Related Prasadam', slug: 'related-prasadam' }],
  categories: [{ id: '1', name: 'Prasadam', icon: '', color: '', productCount: 1, subcategories: [{ id: '2', categoryId: '1', name: 'Temple Prasadam' }] }],
  blogs: [], heroSlides: [], settings: { storeName: 'Brajmart', currency: 'INR', freeShippingThreshold: 499, shippingFee: 49 },
  generatedAt: new Date().toISOString(), catalogComplete: false,
};
const rendered = await render('/product/seo-verification-prasadam', data);
const productOutput = `${rendered.head}\n${rendered.appHtml}`;
for (const marker of ['SEO Verification Prasadam', 'SKU-VERIFY-1', '₹199', 'InStock', 'BreadcrumbList']) {
  assert(productOutput.includes(marker), `Rendered product is missing ${marker}`);
}

for (const name of ['sitemap.xml', 'sitemap-index.xml', 'sitemap-products.xml', 'sitemap-categories.xml', 'sitemap-pages.xml', 'sitemap-blog.xml']) {
  const xml = await fs.readFile(path.join(dist, name), 'utf8');
  assert(xml.startsWith('<?xml'), `${name} is not XML`);
  assert(!xml.includes('?tag=') && !xml.includes('/cart') && !xml.includes('/checkout'), `${name} contains excluded URLs`);
}

console.log('SEO verification passed: rendered HTML, product content, schemas, canonicals, and sitemap exclusions are present.');
