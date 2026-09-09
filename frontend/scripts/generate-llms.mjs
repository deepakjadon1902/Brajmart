import fs from 'node:fs/promises';
import path from 'node:path';
import { getBuildData, SITE_URL, slugify } from './build-data.mjs';

const root = process.cwd();
const publicDir = path.resolve(root, 'public');
const distDir = path.resolve(root, 'dist');
const buildDataCache = path.resolve(root, '.seo-build-data-cache.json');

const data = await fs.readFile(buildDataCache, 'utf8')
  .then((raw) => JSON.parse(raw))
  .catch(() => getBuildData());

const cleanText = (value, maxLength = 240) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trimEnd()}...`;
};

const absolute = (pathname) => `${SITE_URL}${pathname === '/' ? '/' : pathname}`;

const titleCaseFromSlug = (value) => String(value || '')
  .split(/[-/]+/)
  .filter(Boolean)
  .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
  .join(' ');

const loadFallbackPaths = async () => {
  const names = ['sitemap-products.xml', 'sitemap-categories.xml', 'sitemap-blog.xml', 'sitemap-pages.xml', 'sitemap.xml'];
  const files = await Promise.all(names.map((name) => fs.readFile(path.join(publicDir, name), 'utf8').catch(() => '')));
  const paths = files.flatMap((raw) => [...raw.matchAll(/<loc>([^<]+)<\/loc>/g)])
    .map((match) => {
      try {
        return new URL(match[1]).pathname.replace(/\/$/, '') || '/';
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return [...new Set(paths)].filter((item) => !item.includes('?'));
};

const uniqueByPath = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.path || item.path.includes('?')) return false;
    const key = item.path.replace(/\/$/, '') || '/';
    if (seen.has(key)) return false;
    seen.add(key);
    item.path = key;
    return true;
  });
};

const categories = uniqueByPath((Array.isArray(data.categories) ? data.categories : [])
  .map((category) => {
    const slug = slugify(category.name);
    if (!slug) return null;
    const subcategories = (category.subcategories || [])
      .map((subcategory) => ({
        name: cleanText(subcategory.name, 80),
        path: `/category/${slug}/${slugify(subcategory.name)}`,
      }))
      .filter((subcategory) => subcategory.name && !subcategory.path.endsWith('/'));
    return {
      name: cleanText(category.name, 80),
      path: `/category/${slug}`,
      subcategories,
      productCount: Number(category.productCount || 0),
    };
  })
  .filter(Boolean));

const products = uniqueByPath((Array.isArray(data.products) ? data.products : [])
  .filter((product) => product?.slug || product?.name)
  .map((product) => ({
    name: cleanText(product.name, 100),
    path: `/product/${slugify(product.slug || product.name)}`,
    category: cleanText(product.category, 80),
    description: cleanText(product.metaDescription || product.description, 180),
    price: Number(product.price || 0),
    available: product.inStock !== false,
  }))
  .filter((product) => product.name && !product.path.endsWith('/'))
  .slice(0, 40));

const blogs = uniqueByPath((Array.isArray(data.blogs) ? data.blogs : [])
  .filter((post) => post?.slug && post?.title)
  .map((post) => ({
    title: cleanText(post.title, 120),
    path: `/blog/${slugify(post.slug)}`,
    description: cleanText(post.excerpt, 180),
  }))
  .filter((post) => !post.path.endsWith('/'))
  .slice(0, 20));

if (!categories.length || !products.length || !blogs.length) {
  const fallbackPaths = await loadFallbackPaths();
  if (!categories.length) {
    categories.push(...fallbackPaths
      .filter((item) => item.startsWith('/category/') && item.split('/').length === 3)
      .slice(0, 40)
      .map((item) => ({ name: titleCaseFromSlug(item.replace('/category/', '')), path: item, subcategories: [], productCount: 0 })));
  }
  if (!products.length) {
    products.push(...fallbackPaths
      .filter((item) => item.startsWith('/product/') && !/^\d+$/.test(item.replace('/product/', '')))
      .slice(0, 40)
      .map((item) => ({
        name: titleCaseFromSlug(item.replace('/product/', '')),
        path: item,
        category: '',
        description: '',
        price: 0,
        available: true,
      })));
  }
  if (!blogs.length) {
    blogs.push(...fallbackPaths
      .filter((item) => item.startsWith('/blog/') && item !== '/blog')
      .slice(0, 20)
      .map((item) => ({ title: titleCaseFromSlug(item.replace('/blog/', '')), path: item, description: '' })));
  }
}

const categoryLines = categories.length
  ? categories.map((category) => {
      const suffix = category.productCount > 0 ? ` (${category.productCount} products)` : '';
      return `- ${category.name}${suffix}: ${absolute(category.path)}`;
    }).join('\n')
  : '- Browse categories: https://www.brajmart.com/categories';

const subcategoryLines = categories
  .flatMap((category) => category.subcategories || [])
  .slice(0, 40)
  .map((subcategory) => `- ${subcategory.name}: ${absolute(subcategory.path)}`)
  .join('\n');

const productLines = products.length
  ? products.map((product) => {
      const detail = [
        product.category ? `category: ${product.category}` : '',
        product.price > 0 ? `price: INR ${product.price}` : '',
        product.available ? 'availability: check product page' : 'availability: may be unavailable',
      ].filter(Boolean).join('; ');
      return `- ${product.name}: ${absolute(product.path)}${detail ? ` (${detail})` : ''}${product.description ? ` - ${product.description}` : ''}`;
    }).join('\n')
  : '- Product catalog: https://www.brajmart.com/products';

const blogLines = blogs.length
  ? blogs.map((post) => `- ${post.title}: ${absolute(post.path)}${post.description ? ` - ${post.description}` : ''}`).join('\n')
  : '- Blog: https://www.brajmart.com/blog';

const freshnessNote = data.live
  ? `Generated from public catalog API on ${data.generatedAt}.`
  : `Generated with limited fallback data on ${data.generatedAt}; production builds should use a live public catalog API.`;

const content = `# Brajmart

Brajmart is an online devotional commerce website for authentic Vrindavan and Braj-inspired products, including prasadam, tulsi malas, puja items, spiritual books, deity shringar, accessories, groceries, and Braj Yatra-related items.

Canonical site: ${SITE_URL}

## Main Public Sections

- Homepage: ${absolute('/')}
- Products: ${absolute('/products')}
- Categories: ${absolute('/categories')}
- Blog: ${absolute('/blog')}
- About Brajmart: ${absolute('/about')}
- Contact: ${absolute('/contact')}
- Help Center: ${absolute('/help-center')}
- Customer Service: ${absolute('/customer-service')}

## Shopping And Product Information

Public product pages contain product names, descriptions, images, categories, prices in INR, visible stock or availability signals, SKU information when available, shipping/return links, and related products. Cart, checkout, account, admin, payment status, authentication, and order-tracking areas are private or transactional and are not intended for indexing.

## Categories

${categoryLines}
${subcategoryLines ? `\n## Subcategories\n\n${subcategoryLines}` : ''}

## Representative Public Products

The full indexable catalog is listed in the XML sitemap. This file includes a compact, public sample to help machine consumers understand the catalog shape without duplicating every product.

${productLines}

## Blog And Guides

${blogLines}

## Public Policies

- Shipping and Delivery: ${absolute('/shipping-delivery')}
- Return Policy: ${absolute('/return-policy')}
- Privacy Policy: ${absolute('/privacy-policy')}
- Payment Methods: ${absolute('/payment-method')}
- Terms and Conditions: ${absolute('/terms')}

## Machine-Readable Resources

- Robots policy: ${absolute('/robots.txt')}
- Sitemap index: ${absolute('/sitemap-index.xml')}
- Sitemap alias: ${absolute('/sitemap.xml')}
- Product sitemap: ${absolute('/sitemap-products.xml')}
- Category sitemap: ${absolute('/sitemap-categories.xml')}
- Page sitemap: ${absolute('/sitemap-pages.xml')}
- Blog sitemap: ${absolute('/sitemap-blog.xml')}

## Notes For Crawlers And AI Systems

Use canonical URLs from the sitemap and page metadata. Do not treat private routes, administrative routes, customer account pages, checkout, cart, payment callbacks, API endpoints, or query-parameter filter pages as public knowledge sources. This file improves machine readability and discoverability, but it does not guarantee crawling, indexing, ranking, or recommendations by any external AI or search platform.

${freshnessNote}
`;

await Promise.all([publicDir, distDir].map(async (directory) => {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'llms.txt'), content);
}));

console.log(`Generated llms.txt with ${categories.length} categories, ${products.length} representative products, and ${blogs.length} blog posts.`);
