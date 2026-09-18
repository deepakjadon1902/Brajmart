export const SITE_URL = 'https://www.brajmart.com';
export const SITE_NAME = 'Brajmart';
export const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
export const DEFAULT_TITLE = 'Brajmart | Vrindavan Prasadam, Tulsi Mala & Devotional Products';
export const DEFAULT_DESCRIPTION =
  'Explore Brajmart for Vrindavan prasadam, Tulsi Mala, puja items, spiritual books, deity shringar and Braj-inspired devotional products delivered across India.';

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

type CategoryCopy = {
  heading?: string;
  title: string;
  description: string;
  intro: string;
};

const categoryCopy: Record<string, CategoryCopy> = {
  'brajmart-special': {
    title: 'BrajMart Special Collection | Devotional Gifts & Seva Essentials',
    description: 'Browse BrajMart special picks for devotional gifting, worship, festivals and everyday home mandir use.',
    intro: 'Handpicked devotional products selected for gifting, worship, festivals, and everyday seva at home.',
  },
  books: {
    title: 'Spiritual Books Online | Bhagavad Gita, Bhajan Books & Devotional Reading',
    description: 'Explore spiritual books, Bhagavad Gita editions, bhajan books and devotional reading for daily study and family learning.',
    intro: 'Explore scriptures, bhajan books, children devotional books, and thoughtful reading for daily spiritual practice.',
  },
  accessories: {
    title: 'Devotional Accessories | Tulsi Mala, Japa Mala & Spiritual Essentials',
    description: 'Find devotional accessories for japa, temple visits, gifting and home mandir care, including mala and worship essentials.',
    intro: 'Find useful devotional accessories for japa, travel, gifting, temple visits, and home mandir care.',
  },
  clothing: {
    title: 'Devotional Clothing | Traditional Wear & Deity Vastra | BrajMart',
    description: 'Shop devotional clothing, traditional styles, deity vastra and festive wear inspired by Braj devotional culture.',
    intro: 'Shop traditional devotional clothing, kurta styles, deity vastra, and festive wear inspired by Braj culture.',
  },
  groceries: {
    title: 'Satvik Groceries | Fasting Foods & Bhog Ingredients | BrajMart',
    description: 'Browse satvik grocery essentials, fasting ingredients and kitchen staples for bhog, festivals and daily cooking.',
    intro: 'Bring home satvik grocery essentials, fasting ingredients, and kitchen staples for bhog and daily cooking.',
  },
  'idols-shringar': {
    title: 'Laddu Gopal Shringar, Deity Idols & Home Mandir Decor | BrajMart',
    description: 'Discover deity idols, Laddu Gopal shringar, altar decor, ornaments and seva essentials for worship spaces.',
    intro: 'Discover deity idols, shringar pieces, altar decor, ornaments, and seva essentials for worship spaces.',
  },
  'incense-pooja': {
    title: 'Puja Items & Puja Samagri | Incense, Dhoop, Diyas | BrajMart',
    description: 'Choose puja items, puja samagri, incense, dhoop, lamps and sacred essentials for daily worship and festivals.',
    intro: 'Choose incense, dhoop, lamps, puja samagri, and sacred items for daily worship and festival rituals.',
  },
  'incense-pooja-items': {
    title: 'Puja Items & Puja Samagri | Incense, Dhoop, Diyas | BrajMart',
    description: 'Choose puja items, puja samagri, incense, dhoop, lamps and sacred essentials for daily worship and festivals.',
    intro: 'Choose incense, dhoop, lamps, puja samagri, and sacred items for daily worship and festival rituals.',
  },
  prasadam: {
    heading: 'Vrindavan Prasadam',
    title: 'Vrindavan Prasadam Online | Temple Prasadam & Devotional Foods',
    description: 'Browse Vrindavan prasadam, devotional sweets, bhog items and festival offerings from the BrajMart prasadam collection.',
    intro: 'Browse prasadam, sweets, bhog items, and Braj-inspired offerings prepared for devotional occasions.',
  },
  'spiritual-books': {
    title: 'Spiritual Books Online | Bhagavad Gita, Bhajan Books & Devotional Reading',
    description: 'Explore spiritual books, Bhagavad Gita editions, bhajan books and devotional reading for daily study and family learning.',
    intro: 'Explore scriptures, bhajan books, children devotional books, and thoughtful reading for daily spiritual practice.',
  },
  'braj-yatra': {
    title: 'Braj Yatra Essentials | Vrindavan, Mathura & Govardhan Pilgrimage',
    description: 'Prepare for Braj Yatra with travel-friendly devotional items for Vrindavan, Mathura, Govardhan and nearby Braj places.',
    intro: 'Prepare for Braj Yatra with travel-friendly devotional products, temple visit essentials, and pilgrim seva items.',
  },
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
  const copy = categoryCopy[key];
  const intro = copy?.intro || `Browse ${category.toLowerCase()} selected for worship, gifting, festivals, and everyday devotional living.`;
  const pageTitle = subcategory ? `${subcategory} in ${category}` : category;
  const title = subcategory
    ? `${subcategory} | ${category} Collection | Brajmart`
    : copy?.title || `${category} | Devotional Products Collection | Brajmart`;
  const countText = productCount > 0 ? ` Browse ${productCount} products.` : '';
  const description = subcategory
    ? `Browse ${subcategory.toLowerCase()} in the ${category.toLowerCase()} collection for worship, gifting, festivals and devotional use.${countText}`
    : `${copy?.description || `Browse ${category.toLowerCase()} for worship, gifting, festivals and everyday devotional living.`}${countText}`;
  const pageDescription = subcategory
    ? `Browse ${subcategory.toLowerCase()} from our ${category.toLowerCase()} collection, curated for devotees looking for relevant products in one place.`
    : intro;

  return {
    pageTitle,
    metaTitle: cleanMetaText(title, 120),
    metaDescription: cleanMetaText(description, 220),
    description: cleanMetaText(pageDescription, 210),
    heading: subcategory ? `${category} - ${subcategory}` : copy?.heading || titleCase(category),
  };
};
