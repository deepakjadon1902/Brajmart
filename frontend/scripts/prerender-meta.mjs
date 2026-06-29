import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const sitemap = await fs.readFile(path.join(dist, 'sitemap.xml'), 'utf8');

const categoryDescriptions = {
  'brajmart-special': 'Shop handpicked Brajmart Special devotional products for worship, gifting, festivals and everyday seva. Authentic products delivered across India.',
  books: 'Shop authentic spiritual books from Vrindavan, including scriptures, bhajan books and devotional reading for all ages. Pan-India delivery from Brajmart.',
  'spiritual-books': 'Shop authentic spiritual books from Vrindavan, including scriptures, bhajan books and devotional reading for all ages. Pan-India delivery from Brajmart.',
  prasadam: 'Order authentic Vrindavan prasadam, sacred sweets and bhog offerings from Brajmart. Carefully packed and delivered to devotees across India.',
  accessories: 'Shop devotional accessories, Tulsi mala, japa essentials and temple-visit items from Vrindavan. Authentic Brajmart products delivered across India.',
  clothing: 'Shop traditional devotional clothing, deity vastra and festive wear inspired by Braj culture. Authentic Vrindavan products from Brajmart.',
  groceries: 'Shop satvik groceries, fasting ingredients and bhog essentials from Brajmart. Authentic devotional kitchen staples delivered across India.',
  'idols-shringar': 'Shop deity idols, shringar, altar decor and seva essentials from Vrindavan. Discover authentic worship products at Brajmart.',
  'incense-pooja-items': 'Shop incense, dhoop, lamps and authentic pooja samagri from Vrindavan. Brajmart delivers sacred worship essentials across India.',
};

const staticMeta = {
  '/categories': ['All Spiritual Categories | Brajmart', 'Browse Brajmart categories including spiritual books, prasadam, puja items, idols, incense, accessories, clothing and Braj Yatra essentials.'],
  '/about': ['About Brajmart | Authentic Vrindavan Spiritual Store', 'Learn about Brajmart, a Vrindavan-rooted store offering authentic puja samagri, devotional books, prasadam and sacred products across India.'],
  '/contact': ['Contact Brajmart | Orders and Customer Support', 'Contact Brajmart for orders, product questions and support. Reach our Vrindavan-based team by phone, email or visit details.'],
  '/blog': ['Brajmart Blog | Devotional Stories and Spiritual Guides', 'Read devotional stories, shopping guides and spiritual insights from Brajmart, inspired by Vrindavan and the sacred culture of Braj.'],
};

const words = (slug) => slug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const replaceMeta = (html, route, title, description) => {
  const canonical = `${siteUrl}${route}`;
  const safeTitle = escapeAttribute(title);
  const safeDescription = escapeAttribute(description);
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(/<meta(?=[^>]*\bname="description")[^>]*>/i, `<meta name="description" content="${safeDescription}" />`)
    .replace(/<meta(?=[^>]*\bproperty="og:title")[^>]*>/i, `<meta property="og:title" content="${safeTitle}" />`)
    .replace(/<meta(?=[^>]*\bproperty="og:description")[^>]*>/i, `<meta property="og:description" content="${safeDescription}" />`)
    .replace(/<meta(?=[^>]*\bname="twitter:title")[^>]*>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
    .replace(/<meta(?=[^>]*\bname="twitter:description")[^>]*>/i, `<meta name="twitter:description" content="${safeDescription}" />`)
    .replace(/<link(?=[^>]*\brel="canonical")[^>]*>/i, `<link rel="canonical" href="${escapeAttribute(canonical)}" />`)
    .replace(/<meta(?=[^>]*\bproperty="og:url")[^>]*>/i, `<meta property="og:url" content="${escapeAttribute(canonical)}" />`);
};

const metaFor = (route) => {
  if (staticMeta[route]) return staticMeta[route];
  const parts = route.split('/').filter(Boolean);
  if (parts[0] === 'category') {
    const category = words(parts[1] || 'devotional-products');
    const subcategory = parts[2] ? words(parts[2]) : '';
    const name = subcategory || category;
    const description = subcategory
      ? `Shop authentic ${name} from the ${category} collection at Brajmart. Vrindavan-inspired devotional products delivered across India.`
      : categoryDescriptions[parts[1]] || `Shop authentic ${category} from Vrindavan at Brajmart. Devotional products for worship, gifting and festivals, delivered across India.`;
    return [`Buy ${name} Online | Authentic Vrindavan Products | Brajmart`, description];
  }
  if (parts[0] === 'product') {
    const name = words(parts[1] || 'devotional-product');
    return [`Buy ${name} Online | Brajmart`, `Buy ${name} from Brajmart. Shop authentic Vrindavan spiritual and devotional products with secure delivery across India.`];
  }
  if (parts[0] === 'blog') {
    const name = words(parts[1] || 'article');
    return [`${name} | Brajmart Blog`, `Read ${name}, devotional guidance and spiritual insights from Brajmart, inspired by Vrindavan and Braj culture.`];
  }
  if (parts[0] === 'braj-darshan') {
    const name = words(parts[1] || 'braj');
    return [`${name} Darshan and Yatra Guide | Brajmart`, `Explore ${name} with Brajmart's Braj Darshan guide, including sacred places, temple traditions and practical pilgrimage information.`];
  }
  return null;
};

const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => new URL(match[1]).pathname.replace(/\/$/, '') || '/')
  .filter((route) => route !== '/');

let count = 0;
for (const route of new Set([...routes, ...Object.keys(staticMeta)])) {
  const meta = metaFor(route);
  if (!meta) continue;
  const output = path.join(dist, ...route.split('/').filter(Boolean), 'index.html');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, replaceMeta(template, route, meta[0], meta[1]));
  count += 1;
}

console.log(`Generated crawlable HTML metadata for ${count} routes.`);
