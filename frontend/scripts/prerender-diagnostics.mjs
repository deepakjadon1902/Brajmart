import { slugify } from './catalog-validation.mjs';
import { describeCatalogEntry, sanitizeBuildDiagnostic } from './seo-diagnostics.mjs';

export const describeCatalogRoute = (route, catalog) => {
  const [, kind, slug, subSlug] = route.split('/');
  const collection = kind === 'category' ? 'categories' : kind === 'product' ? 'products' : kind === 'blog' ? 'blogs' : null;
  if (!collection) return `static route ${route}`;
  const entries = catalog[collection] || [];
  const index = entries.findIndex(entry => slugify(kind === 'category' ? entry.name : entry.slug || entry.name) === slug);
  if (index < 0) return `route ${route}`;
  let description = describeCatalogEntry(collection, index, entries[index]);
  if (subSlug) {
    const subIndex = (entries[index].subcategories || []).findIndex(entry => slugify(entry.name) === subSlug);
    if (subIndex >= 0) description += `; ${describeCatalogEntry(`${collection}[${index}].subcategories`, subIndex, entries[index].subcategories[subIndex])}`;
  }
  return description;
};

export const renderCatalogPage = async (render, route, data, catalog) => {
  try {
    const result = await render(route, data);
    if (typeof result?.appHtml !== 'string' || !result.appHtml.trim()) throw new Error('SSR produced empty HTML');
    return result;
  } catch (error) {
    throw new Error(sanitizeBuildDiagnostic(`SEO prerender failed for ${route} (${describeCatalogRoute(route, catalog)}): ${error instanceof Error ? error.message : 'SSR failed'}`));
  }
};
