export type ProductAuditIssueSeverity = 'error' | 'warning';

export type ProductAuditIssue = {
  code: string;
  field: string;
  severity: ProductAuditIssueSeverity;
  message: string;
};

export type ProductAuditItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number | null;
  originalPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  inStock: boolean;
  issueCount: number;
  issues: ProductAuditIssue[];
};

export type ProductAuditReport = {
  generatedAt: string;
  totalProducts: number;
  productsWithIssues: number;
  errorCount: number;
  warningCount: number;
  issuesByCode: Record<string, number>;
  items: ProductAuditItem[];
};

const toText = (value: unknown) => String(value ?? '').trim();

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const addIssue = (
  issues: ProductAuditIssue[],
  code: string,
  field: string,
  severity: ProductAuditIssueSeverity,
  message: string,
) => {
  issues.push({ code, field, severity, message });
};

export const auditProductRecord = (row: any): ProductAuditItem => {
  const price = toNumberOrNull(row.price);
  const originalPrice = toNumberOrNull(row.original_price ?? row.originalPrice);
  const rating = toNumberOrNull(row.rating);
  const reviewCount = toNumberOrNull(row.review_count ?? row.reviewCount);
  const image = toText(row.image);
  const name = toText(row.name);
  const slug = toText(row.slug);
  const category = toText(row.category_name ?? row.category);
  const description = toText(row.description);
  const metaTitle = toText(row.meta_title ?? row.metaTitle);
  const metaDescription = toText(row.meta_description ?? row.metaDescription);
  const issues: ProductAuditIssue[] = [];

  if (!name) addIssue(issues, 'MISSING_NAME', 'name', 'error', 'Product name is missing.');
  if (!slug) addIssue(issues, 'MISSING_SLUG', 'slug', 'error', 'Product slug is missing.');
  if (!category) addIssue(issues, 'MISSING_CATEGORY', 'category', 'error', 'Product category is missing.');
  if (!image) addIssue(issues, 'MISSING_IMAGE', 'image', 'error', 'Primary product image is missing.');
  if (!description) addIssue(issues, 'MISSING_DESCRIPTION', 'description', 'warning', 'Product description is missing.');
  if (!metaTitle) addIssue(issues, 'MISSING_SEO_TITLE', 'metaTitle', 'warning', 'SEO title is missing.');
  if (!metaDescription) addIssue(issues, 'MISSING_SEO_DESCRIPTION', 'metaDescription', 'warning', 'SEO description is missing.');

  if (price === null) {
    addIssue(issues, 'MISSING_PRICE', 'price', 'error', 'Sale price is missing or invalid.');
  } else if (price <= 0) {
    addIssue(issues, 'INVALID_PRICE', 'price', 'error', 'Sale price must be greater than 0.');
  }

  if (originalPrice !== null && originalPrice < 0) {
    addIssue(issues, 'INVALID_MRP', 'originalPrice', 'error', 'MRP cannot be negative.');
  }

  if (price !== null && originalPrice !== null && originalPrice > 0) {
    if (price > originalPrice) {
      addIssue(issues, 'PRICE_ABOVE_MRP', 'price', 'warning', 'Sale price is higher than MRP.');
    }
    const discountPercent = ((originalPrice - price) / originalPrice) * 100;
    if (!Number.isFinite(discountPercent) || discountPercent < 0) {
      addIssue(issues, 'INVALID_DISCOUNT', 'discount', 'warning', 'Discount cannot be negative.');
    }
    if (discountPercent > 100) {
      addIssue(issues, 'DISCOUNT_OVER_100', 'discount', 'error', 'Discount cannot be greater than 100%.');
    }
  }

  if (rating === null) {
    addIssue(issues, 'INVALID_RATING', 'rating', 'warning', 'Rating is missing or invalid.');
  } else if (rating < 0 || rating > 5) {
    addIssue(issues, 'RATING_OUT_OF_RANGE', 'rating', 'error', 'Rating must be between 0 and 5.');
  }

  if (reviewCount === null) {
    addIssue(issues, 'INVALID_REVIEW_COUNT', 'reviewCount', 'warning', 'Review count is missing or invalid.');
  } else if (reviewCount < 0) {
    addIssue(issues, 'NEGATIVE_REVIEW_COUNT', 'reviewCount', 'error', 'Review count cannot be negative.');
  }

  if (reviewCount !== null && reviewCount <= 0 && rating !== null && rating > 0) {
    addIssue(issues, 'RATING_WITHOUT_REVIEWS', 'rating', 'warning', 'Rating is shown even though review count is 0.');
  }

  return {
    id: toText(row.id ?? row._id),
    name,
    slug,
    category,
    price,
    originalPrice,
    rating,
    reviewCount,
    inStock: Boolean(Number(row.in_stock ?? row.inStock ?? 0)),
    issueCount: issues.length,
    issues,
  };
};

export const buildProductAuditReport = (rows: any[]): ProductAuditReport => {
  const items = (Array.isArray(rows) ? rows : []).map(auditProductRecord).filter((item) => item.issues.length > 0);
  const issues = items.flatMap((item) => item.issues);
  const issuesByCode = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.code] = (acc[issue.code] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totalProducts: Array.isArray(rows) ? rows.length : 0,
    productsWithIssues: items.length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    issuesByCode,
    items,
  };
};
