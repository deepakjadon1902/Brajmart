export const SITE_URL = 'https://www.brajmart.com';
export const SITE_NAME = 'Brajmart';
export const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
export const DEFAULT_TITLE = 'Brajmart — Authentic Vrindavan Products | Prasadam, Tulsi Mala, Puja Items Online';
export const DEFAULT_DESCRIPTION =
  'Buy authentic spiritual products directly from Vrindavan, Mathura. Prasadam, Tulsi Mala, Radha Krishna Idols, Puja Samagri, Books and Braj Yatra. Free shipping above ₹499. Pan India delivery.';

export const absoluteUrl = (path = '/') => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const cleanMetaText = (value: string, maxLength = 160) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
};

export const safeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export const breadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

const categoryIntros: Record<string, string> = {
  'brajmart-special': 'Handpicked devotional products selected for gifting, worship, festivals, and everyday seva at home.',
  books: 'Explore scriptures, bhajan books, children devotional books, and thoughtful reading for daily spiritual practice.',
  accessories: 'Find useful devotional accessories for japa, travel, gifting, temple visits, and home mandir care.',
  clothing: 'Shop traditional devotional clothing, kurta styles, deity vastra, and festive wear inspired by Braj culture.',
  groceries: 'Bring home satvik grocery essentials, fasting ingredients, and kitchen staples for bhog and daily cooking.',
  'idols-shringar': 'Discover deity idols, shringar pieces, altar decor, ornaments, and seva essentials for worship spaces.',
  'incense-pooja': 'Choose incense, dhoop, lamps, pooja samagri, and sacred items for daily worship and festival rituals.',
  'incense-pooja-items': 'Choose incense, dhoop, lamps, pooja samagri, and sacred items for daily worship and festival rituals.',
  prasadam: 'Browse prasadam, sweets, bhog items, and Braj-inspired offerings prepared for devotional occasions.',
  'spiritual-books': 'Explore scriptures, bhajan books, children devotional books, and thoughtful reading for daily spiritual practice.',
  'braj-yatra': 'Prepare for Braj Yatra with travel-friendly devotional products, temple visit essentials, and pilgrim seva items.',
};

const titleCase = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

export const categorySeo = (categoryName: string, subcategoryName = '', productCount = 0) => {
  const category = cleanMetaText(categoryName || 'Devotional Products', 80);
  const subcategory = cleanMetaText(subcategoryName || '', 80);
  const key = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const intro = categoryIntros[key] || `Browse ${category.toLowerCase()} selected for worship, gifting, festivals, and everyday devotional living.`;
  const pageTitle = subcategory ? `${subcategory} in ${category}` : category;
  const title = subcategory
    ? `Buy ${subcategory} Online — Authentic Vrindavan Products | Brajmart`
    : `Buy ${category} Online — Authentic Vrindavan Products | Brajmart`;
  const description = subcategory
    ? `Shop authentic ${subcategory} from Vrindavan, Mathura. Temple-sourced, 100% genuine. Free shipping above ₹499. Delivered across India. Browse ${productCount}+ products.`
    : `Shop authentic ${category} from Vrindavan, Mathura. Temple-sourced, 100% genuine. Free shipping above ₹499. Delivered across India. Browse ${productCount}+ products.`;
  const pageDescription = subcategory
    ? `Browse ${subcategory.toLowerCase()} from our ${category.toLowerCase()} collection, curated for devotees who want authentic Vrindavan-inspired products delivered across India.`
    : intro;

  return {
    pageTitle,
    metaTitle: cleanMetaText(title, 120),
    metaDescription: cleanMetaText(description, 220),
    description: cleanMetaText(pageDescription, 210),
    heading: subcategory ? `${category} - ${subcategory}` : titleCase(category),
  };
};
