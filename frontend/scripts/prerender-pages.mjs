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
const buildDataMeta = path.resolve(process.cwd(), '.seo-build-data-meta.json');
const buildSummary = {
  generatedAt: buildData.generatedAt,
  live: buildData.live,
  error: buildData.error ? buildData.error.message : null,
  meta: buildData.meta,
};
await fs.writeFile(buildDataCache, JSON.stringify(buildData));
await fs.writeFile(buildDataMeta, JSON.stringify(buildSummary, null, 2));

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
const prerenderCounts = {
  productsFetched: buildData.products.length,
  categoriesFetched: buildData.categories.length,
  blogsFetched: buildData.blogs.length,
  heroSlidesFetched: buildData.heroSlides.length,
  productRoutes: productPages.length,
  categoryRoutes: categoryPages.length,
  blogRoutes: blogPages.length,
  staticRoutes: publicPages.length + brajPages.length,
  totalRoutes: routes.length,
};

const normalizedName = (value) => (value || '').trim().toLowerCase();
const isBrajmartSpecial = (name) => normalizedName(name) === 'brajmart special';
const isPrasadam = (name) => normalizedName(name) === 'prasadam';
const isBooks = (name) => ['books', 'spiritual books'].includes(normalizedName(name));
const isAccessories = (name) => normalizedName(name) === 'accessories';
const uniqueByProductKey = (products) => {
  const seen = new Set();
  return products.filter((product) => {
    const key = String(product.id || product.slug || product.name || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const toProductListData = (product) => ({
  id: String(product.id || product._id || ''),
  name: product.name,
  slug: product.slug,
  price: product.price,
  originalPrice: product.originalPrice,
  image: product.image,
  images: Array.isArray(product.images) ? product.images.slice(0, 2) : (product.image ? [product.image] : []),
  categoryId: product.categoryId,
  subcategoryId: product.subcategoryId,
  category: product.category,
  subcategory: product.subcategory,
  rating: product.rating,
  reviewCount: product.reviewCount,
  badge: product.badge,
  tags: product.tags,
  inStock: product.inStock,
  codEnabled: product.codEnabled,
  categoryCodEnabled: product.categoryCodEnabled,
});
const homeRouteProducts = () => {
  const categorySections = buildData.categories || [];
  const brajmartSpecialCategory = categorySections.find((category) => isBrajmartSpecial(category.name));
  const regularCategories = categorySections.filter((category) => !isBrajmartSpecial(category.name) && !isPrasadam(category.name));
  const prasadamCategory = categorySections.find((category) => isPrasadam(category.name));
  const booksIndex = regularCategories.findIndex((category) => isBooks(category.name));
  const orderedCategories = prasadamCategory
    ? [
        ...regularCategories.slice(0, booksIndex >= 0 ? booksIndex : regularCategories.length),
        prasadamCategory,
        ...regularCategories.slice(booksIndex >= 0 ? booksIndex : regularCategories.length),
      ]
    : regularCategories;
  const productsForCategory = (category) => category
    ? buildData.products.filter((product) => slugify(product.category || '') === slugify(category.name)).slice(0, 12)
    : [];
  const homepageGroups = [
    productsForCategory(brajmartSpecialCategory),
    buildData.products.filter((product) => (product.tags || []).includes('bestseller')).slice(0, 12),
    productsForCategory(prasadamCategory),
    ...orderedCategories.filter((category) => !isPrasadam(category.name)).slice(0, 4).map(productsForCategory),
    buildData.products.filter((product) => isBooks(product.category)).slice(0, 4),
    buildData.products.filter((product) => (product.tags || []).includes('accessories') || isAccessories(product.category)).slice(0, 12),
  ];

  return uniqueByProductKey(homepageGroups.flat()).map(toProductListData);
};

const dataForRoute = (route) => {
  const parts = route.split('/').filter(Boolean);
  let products = [];
  let blogs = [];
  let catalogComplete = false;
  if (route === '/') {
    products = homeRouteProducts();
  } else if (route === '/products') {
    products = buildData.products;
    catalogComplete = true;
  } else if (parts[0] === 'category') {
    products = buildData.products.filter((product) => {
      if (slugify(product.category) !== parts[1]) return false;
      return !parts[2] || slugify(product.subcategory) === parts[2];
    });
  } else if (parts[0] === 'product') {
    const current = buildData.products.find((product) => slugify(product.slug || product.name) === parts[1]);
    if (current) {
      const candidates = buildData.products.filter((product) => product.id !== current.id && product.slug !== current.slug);
      const sameCategory = candidates.filter((product) => slugify(product.category) === slugify(current.category));
      const fallback = candidates.filter((product) => !sameCategory.some((related) => related.id === product.id));
      products = [current, ...sameCategory, ...fallback].slice(0, 13);
    }
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

const toResponsiveImageUrl = (rawUrl, { width, height, fit = 'cover', quality = 74 } = {}) => {
  if (!rawUrl) return '';
  const roundedWidth = Math.max(1, Math.round(width || 720));
  const roundedHeight = Math.max(1, Math.round(height || roundedWidth));
  const roundedQuality = Math.min(100, Math.max(35, Math.round(quality)));
  if (rawUrl.includes('ik.imagekit.io')) {
    try {
      const parsed = new URL(rawUrl);
      const crop = fit === 'contain' ? 'c-at_max' : 'c-at_least';
      parsed.searchParams.set('tr', `w-${roundedWidth},h-${roundedHeight},${crop},q-${roundedQuality},f-webp`);
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
};

const toResponsiveImageSrcSet = (rawUrl, widths, options) => widths
  .map((width) => `${toResponsiveImageUrl(rawUrl, { ...options, width })} ${width}w`)
  .join(', ');

const escapeAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;');

const getHomeHeroPreload = (routeData) => {
  const slide = Array.isArray(routeData.heroSlides)
    ? routeData.heroSlides.find((item) => item?.image && item?.isActive !== false) || routeData.heroSlides.find((item) => item?.image)
    : null;
  if (!slide?.image) return '';

  const widths = [360, 480, 640, 720, 840];
  const href = toResponsiveImageUrl(slide.image, { width: 720, fit: 'contain', quality: 70 });
  const srcSet = toResponsiveImageSrcSet(slide.image, widths, { fit: 'contain', quality: 70 });
  const attrs = [
    'rel="preload"',
    'as="image"',
    `href="${escapeAttribute(href)}"`,
    `imagesrcset="${escapeAttribute(srcSet)}"`,
    'imagesizes="84vw"',
    'fetchpriority="high"',
    'media="(max-width: 639px)"',
  ];
  const preconnect = '<link rel="preconnect" href="https://ik.imagekit.io" crossorigin />';
  return `${preconnect}\n<link ${attrs.join(' ')} />`;
};

for (const route of routes) {
  const routeData = dataForRoute(route);
  const { appHtml, head } = await render(route, routeData);
  const initialDataScript = `<script>window.__BRAJMART_INITIAL_DATA__=${serialize(routeData)};</script>`;
  const heroPreload = route === '/' ? getHomeHeroPreload(routeData) : '';
  const html = stripManagedHead(template)
    .replace('</head>', `${head}\n${heroPreload}\n${initialDataScript}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
  const output = route === '/'
    ? path.join(dist, 'index.html')
    : path.join(dist, ...route.split('/').filter(Boolean), 'index.html');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html);

  if (route !== '/') {
    const parts = route.split('/').filter(Boolean);
    const aliasOutput = path.join(dist, ...parts.slice(0, -1), `${parts.at(-1)}.html`);
    await fs.mkdir(path.dirname(aliasOutput), { recursive: true });
    await fs.writeFile(aliasOutput, html);
  }
}

// Vercel serves this document with a real HTTP 404 for paths that are not in
// the explicit SPA allowlist. Keeping the React not-found UI also preserves a
// consistent customer experience for broken external links.
const notFoundData = dataForRoute('/404');
const { appHtml: notFoundHtml, head: notFoundHead } = await render('/404', notFoundData);
const notFoundInitialData = `<script>window.__BRAJMART_INITIAL_DATA__=${serialize(notFoundData)};</script>`;
const notFoundDocument = stripManagedHead(template)
  .replace('</head>', `${notFoundHead}\n${notFoundInitialData}\n</head>`)
  .replace('<div id="root"></div>', `<div id="root">${notFoundHtml}</div>`);
await fs.writeFile(path.join(dist, '404.html'), notFoundDocument);

console.log(`Pre-rendered complete React HTML for ${routes.length} public routes (${productPages.length} products).`);
console.log(`Prerender catalog counts: ${JSON.stringify(prerenderCounts)}`);
if (!buildData.live) {
  console.warn(`Prerender catalog warning: live catalog data unavailable. ${buildData.error?.message || 'Unknown error'}`);
}
