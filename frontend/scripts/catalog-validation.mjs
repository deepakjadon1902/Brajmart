import { describeCatalogEntry, sanitizeBuildDiagnostic } from './seo-diagnostics.mjs';

// Keep the established storefront, prerender, and sitemap slug mapping unchanged.
export const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const fail = (collection, index, entry, reason) => {
  throw new Error(sanitizeBuildDiagnostic(`Invalid SEO catalog entry ${describeCatalogEntry(collection, index, entry)}: ${reason}`));
};
const checkEntry = (collection, index, entry, nameField = 'name') => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(collection, index, entry, 'expected an object');
  if (typeof entry[nameField] !== 'string' || !entry[nameField].trim()) fail(collection, index, entry, `${nameField} must be a non-empty string`);
};
const claimRoute = (routes, route, collection, index, entry) => {
  if (routes.has(route)) fail(collection, index, entry, `duplicate route ${route}; first entry is ${routes.get(route)}`);
  routes.set(route, describeCatalogEntry(collection, index, entry));
};

export const validateSeoCatalog = ({ products, categories, blogs }) => {
  for (const [name, entries] of Object.entries({ products, categories, blogs })) {
    if (!Array.isArray(entries)) throw new Error(`Catalog API /${name} expected a JSON array; received ${entries === null ? 'null' : typeof entries}`);
  }
  if (!products.length || !categories.length) {
    throw new Error(`The public catalog API returned no products or categories (products=${products.length}, categories=${categories.length})`);
  }
  const routes = new Map();
  categories.forEach((category, index) => {
    checkEntry('categories', index, category);
    const path = `/category/${slugify(category.name)}`;
    if (path.endsWith('/')) fail('categories', index, category, 'name produces an empty category slug');
    claimRoute(routes, path, 'categories', index, category);
    if (category.subcategories != null && !Array.isArray(category.subcategories)) fail('categories', index, category, 'subcategories must be an array');
    (category.subcategories || []).forEach((subcategory, subIndex) => {
      const collection = `categories[${index}].subcategories`;
      checkEntry(collection, subIndex, subcategory);
      const subPath = `${path}/${slugify(subcategory.name)}`;
      if (subPath.endsWith('/')) fail(collection, subIndex, subcategory, `name produces an empty subcategory slug under ${path}`);
      claimRoute(routes, subPath, collection, subIndex, subcategory);
    });
  });
  products.forEach((product, index) => {
    checkEntry('products', index, product);
    if (product.slug != null && typeof product.slug !== 'string') fail('products', index, product, 'slug must be a string');
    const path = `/product/${slugify(product.slug || product.name)}`;
    if (path.endsWith('/')) fail('products', index, product, 'slug/name produces an empty product slug');
    claimRoute(routes, path, 'products', index, product);
    if (product.category != null && typeof product.category !== 'string') fail('products', index, product, 'category must be a string');
  });
  blogs.forEach((blog, index) => {
    checkEntry('blogs', index, blog, 'title');
    if (typeof blog.slug !== 'string' || !slugify(blog.slug)) fail('blogs', index, blog, 'slug must produce a non-empty blog route');
    claimRoute(routes, `/blog/${slugify(blog.slug)}`, 'blogs', index, blog);
  });
  return { products: products.length, categories: categories.length, blogs: blogs.length, catalogRoutes: routes.size };
};
