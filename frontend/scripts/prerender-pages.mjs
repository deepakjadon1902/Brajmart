import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getBuildData, slugify } from './build-data.mjs';

const dist = path.resolve(process.cwd(), 'dist');
const serverEntry = path.resolve(process.cwd(), 'dist-ssr/entry-server.js');
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const { render } = await import(`${pathToFileURL(serverEntry).href}?t=${Date.now()}`);
const buildData = await getBuildData();
const buildDataCache = path.resolve(process.cwd(), '.seo-build-data-cache.json');
await fs.writeFile(buildDataCache, JSON.stringify(buildData));

const publicPages = [
  '/', '/categories', '/products', '/about', '/contact', '/blog', '/help-center',
  '/customer-service', '/shipping-delivery', '/return-policy', '/privacy-policy',
  '/payment-method', '/terms',
];
const brajPages = ['vrindavan', 'mathura', 'govardhan', 'nandgaon', 'barsana', 'gokul'].map((slug) => `/braj-darshan/${slug}`);
const categoryPages = buildData.categories.flatMap((category) => {
  const categorySlug = slugify(category.name);
  if (!categorySlug) return [];
  return [
    `/category/${categorySlug}`,
    ...(category.subcategories || []).map((subcategory) => `/category/${categorySlug}/${slugify(subcategory.name)}`).filter((route) => !route.endsWith('/')),
  ];
});
const productPages = buildData.products.map((product) => `/product/${slugify(product.slug || product.name)}`).filter((route) => !route.endsWith('/'));
const blogPages = buildData.blogs.map((post) => `/blog/${slugify(post.slug)}`).filter((route) => !route.endsWith('/'));
const routes = [...new Set([...publicPages, ...brajPages, ...categoryPages, ...productPages, ...blogPages])];

const dataForRoute = (route) => {
  const parts = route.split('/').filter(Boolean);
  let products = [];
  let blogs = [];
  let catalogComplete = false;
  if (route === '/' || route === '/products') {
    products = buildData.products;
    catalogComplete = true;
  } else if (parts[0] === 'category') {
    products = buildData.products.filter((product) => {
      if (slugify(product.category) !== parts[1]) return false;
      return !parts[2] || slugify(product.subcategory) === parts[2];
    });
  } else if (parts[0] === 'product') {
    const current = buildData.products.find((product) => slugify(product.slug || product.name) === parts[1]);
    products = current
      ? [current, ...buildData.products.filter((product) => product.id !== current.id && slugify(product.category) === slugify(current.category)).slice(0, 12)]
      : [];
  }
  if (parts[0] === 'blog') blogs = buildData.blogs;
  return {
    products,
    categories: buildData.categories,
    blogs,
    heroSlides: route === '/' ? buildData.heroSlides : [],
    settings: buildData.settings,
    generatedAt: buildData.generatedAt,
    catalogComplete,
  };
};

const stripManagedHead = (html) => html
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .replace(/<meta(?=[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="(?:og:[^"]+|product:[^"]+)"))[^>]*>/gi, '')
  .replace(/<link(?=[^>]*rel="canonical")[^>]*>/gi, '')
  .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

const serialize = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

for (const route of routes) {
  const routeData = dataForRoute(route);
  const { appHtml, head } = await render(route, routeData);
  const initialDataScript = `<script>window.__BRAJMART_INITIAL_DATA__=${serialize(routeData)};</script>`;
  const html = stripManagedHead(template)
    .replace('</head>', `${head}\n${initialDataScript}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
  const output = route === '/'
    ? path.join(dist, 'index.html')
    : path.join(dist, ...route.split('/').filter(Boolean), 'index.html');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html);
}

console.log(`Pre-rendered complete React HTML for ${routes.length} public routes (${productPages.length} products).`);
