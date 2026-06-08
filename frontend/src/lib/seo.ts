export const SITE_URL = 'https://www.brajmart.com';
export const SITE_NAME = 'Brajmart';
export const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
export const DEFAULT_TITLE = 'Brajmart - Spiritual Books, Puja Items, Prasadam & Braj Yatra Online';
export const DEFAULT_DESCRIPTION =
  'Shop authentic puja items, spiritual books, prasadam, deity idols, tulsi mala and devotional accessories from the sacred land of Vrindavan. Delivered across India.';

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
