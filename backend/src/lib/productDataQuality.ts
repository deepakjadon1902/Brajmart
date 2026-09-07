export type ProductAuditIssueSeverity = 'error' | 'warning';

export type ProductAuditIssue = {
  code: string;
  field: string;
  severity: ProductAuditIssueSeverity;
  message: string;
  currentValue?: unknown;
  recommendedCorrection?: string;
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
  stockQuantity: number | null;
  reservedQuantity: number | null;
  lowStockThreshold: number | null;
  sku: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
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
  currentValue?: unknown,
  recommendedCorrection?: string,
) => {
  issues.push({ code, field, severity, message, currentValue, recommendedCorrection });
};

export const auditProductRecord = (row: any): ProductAuditItem => {
  const price = toNumberOrNull(row.price);
  const originalPrice = toNumberOrNull(row.original_price ?? row.originalPrice);
  const rating = toNumberOrNull(row.rating);
  const reviewCount = toNumberOrNull(row.review_count ?? row.reviewCount);
  const stockQuantity = toNumberOrNull(row.stock_quantity ?? row.stockQuantity);
  const reservedQuantity = toNumberOrNull(row.reserved_quantity ?? row.reservedQuantity) ?? 0;
  const lowStockThreshold = toNumberOrNull(row.low_stock_threshold ?? row.lowStockThreshold);
  const sku = toText(row.sku);
  const image = toText(row.image);
  const name = toText(row.name);
  const slug = toText(row.slug);
  const category = toText(row.category_name ?? row.category);
  const categoryId = toText(row.category_id ?? row.categoryId);
  const categoryName = toText(row.category_name);
  const legacyCategory = toText(row.category);
  const description = toText(row.description);
  const metaTitle = toText(row.meta_title ?? row.metaTitle);
  const metaDescription = toText(row.meta_description ?? row.metaDescription);
  const issues: ProductAuditIssue[] = [];

  if (!name) addIssue(issues, 'MISSING_NAME', 'name', 'error', 'Product name is missing.', name, 'Add a clear product name.');
  if (!slug) addIssue(issues, 'MISSING_SLUG', 'slug', 'error', 'Product slug is missing.', slug, 'Add a unique URL slug.');
  if (!sku) addIssue(issues, 'MISSING_SKU', 'sku', 'error', 'SKU is missing.', sku, 'Add a unique stable SKU.');
  if (!category) addIssue(issues, 'MISSING_CATEGORY', 'category', 'error', 'Product category is missing.', category, 'Choose an existing category.');
  if (categoryId && !categoryName) {
    addIssue(issues, 'INVALID_CATEGORY', 'category', 'error', 'Product is linked to a missing category.', legacyCategory || categoryId, 'Choose an existing category.');
  }
  if (!image) addIssue(issues, 'MISSING_IMAGE', 'image', 'error', 'Primary product image is missing.', image, 'Upload a primary product image.');
  if (!description) addIssue(issues, 'MISSING_DESCRIPTION', 'description', 'warning', 'Product description is missing.', description, 'Add a short accurate description.');
  if (!metaTitle) addIssue(issues, 'MISSING_SEO_TITLE', 'metaTitle', 'warning', 'SEO title is missing.', metaTitle, 'Add a concise SEO title.');
  if (!metaDescription) addIssue(issues, 'MISSING_SEO_DESCRIPTION', 'metaDescription', 'warning', 'SEO description is missing.', metaDescription, 'Add a concise SEO description.');

  if (price === null) {
    addIssue(issues, 'MISSING_PRICE', 'price', 'error', 'Sale price is missing or invalid.', row.price, 'Set a sale price greater than 0.');
  } else if (price <= 0) {
    addIssue(issues, 'INVALID_PRICE', 'price', 'error', 'Sale price must be greater than 0.', price, 'Set a sale price greater than 0.');
  }

  if (originalPrice !== null && originalPrice < 0) {
    addIssue(issues, 'INVALID_MRP', 'originalPrice', 'error', 'MRP cannot be negative.', originalPrice, 'Clear MRP or set it greater than 0.');
  }

  if (price !== null && originalPrice !== null && originalPrice > 0) {
    if (price > originalPrice) {
      addIssue(issues, 'PRICE_ABOVE_MRP', 'price', 'error', 'Sale price is higher than MRP.', { price, originalPrice }, 'Set MRP greater than or equal to sale price.');
    }
    const discountPercent = ((originalPrice - price) / originalPrice) * 100;
    if (!Number.isFinite(discountPercent) || discountPercent < 0) {
      addIssue(issues, 'INVALID_DISCOUNT', 'discount', 'error', 'Discount cannot be negative.', discountPercent, 'Set MRP greater than or equal to sale price.');
    }
    if (discountPercent > 100) {
      addIssue(issues, 'DISCOUNT_OVER_100', 'discount', 'error', 'Discount cannot be greater than 100%.', discountPercent, 'Correct price and MRP.');
    }
  }

  if (rating === null) {
    addIssue(issues, 'INVALID_RATING', 'rating', 'warning', 'Rating is missing or invalid.', row.rating, 'Use a rating between 0 and 5.');
  } else if (rating < 0 || rating > 5) {
    addIssue(issues, 'RATING_OUT_OF_RANGE', 'rating', 'error', 'Rating must be between 0 and 5.', rating, 'Use a rating between 0 and 5.');
  }

  if (reviewCount === null) {
    addIssue(issues, 'INVALID_REVIEW_COUNT', 'reviewCount', 'warning', 'Review count is missing or invalid.', row.review_count ?? row.reviewCount, 'Use 0 or a valid review count.');
  } else if (reviewCount < 0) {
    addIssue(issues, 'NEGATIVE_REVIEW_COUNT', 'reviewCount', 'error', 'Review count cannot be negative.', reviewCount, 'Use 0 or a valid review count.');
  }

  if (reviewCount !== null && reviewCount <= 0 && rating !== null && rating > 0) {
    addIssue(issues, 'RATING_WITHOUT_REVIEWS', 'rating', 'warning', 'Rating is shown even though review count is 0.', { rating, reviewCount }, 'Set rating to 0 or add real reviews.');
  }

  if (lowStockThreshold === null || lowStockThreshold < 0) {
    addIssue(issues, 'INVALID_LOW_STOCK_THRESHOLD', 'lowStockThreshold', 'error', 'Low stock threshold cannot be negative or invalid.', lowStockThreshold, 'Set threshold to 0 or higher.');
  }
  if (stockQuantity !== null && stockQuantity < 0) {
    addIssue(issues, 'NEGATIVE_STOCK', 'stockQuantity', 'error', 'Stock quantity cannot be negative.', stockQuantity, 'Adjust stock to 0 or higher.');
  }
  if (reservedQuantity !== null && reservedQuantity < 0) {
    addIssue(issues, 'NEGATIVE_RESERVED_STOCK', 'reservedQuantity', 'error', 'Reserved quantity cannot be negative.', reservedQuantity, 'Investigate reservations before correction.');
  }
  if (stockQuantity !== null && reservedQuantity !== null && reservedQuantity > stockQuantity) {
    addIssue(issues, 'RESERVED_EXCEEDS_STOCK', 'reservedQuantity', 'error', 'Reserved quantity cannot exceed stock quantity.', { stockQuantity, reservedQuantity }, 'Resolve reservations before lowering stock.');
  }
  if (stockQuantity !== null && stockQuantity - (reservedQuantity || 0) <= 0 && Boolean(Number(row.in_stock ?? row.inStock ?? 0))) {
    addIssue(issues, 'IN_STOCK_WITHOUT_AVAILABLE_STOCK', 'inStock', 'warning', 'Product is marked in stock with no available stock.', { stockQuantity, reservedQuantity }, 'Mark out of stock or increase physical stock.');
  }
  if (stockQuantity !== null && stockQuantity - (reservedQuantity || 0) > 0 && !Boolean(Number(row.in_stock ?? row.inStock ?? 0))) {
    addIssue(issues, 'OUT_OF_STOCK_FLAG_WITH_AVAILABLE_STOCK', 'inStock', 'warning', 'Product has available inventory but is marked out of stock.', { stockQuantity, reservedQuantity }, 'Mark in stock or explain why product is inactive.');
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
    stockQuantity,
    reservedQuantity,
    lowStockThreshold,
    sku,
    description,
    metaTitle,
    metaDescription,
    issueCount: issues.length,
    issues,
  };
};

export const buildProductAuditReport = (rows: any[]): ProductAuditReport => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const slugCounts = sourceRows.reduce<Record<string, number>>((acc, row) => {
    const slug = toText(row.slug).toLowerCase();
    if (slug) acc[slug] = (acc[slug] || 0) + 1;
    return acc;
  }, {});
  const items = sourceRows.map((row) => {
    const item = auditProductRecord(row);
    const slugKey = item.slug.toLowerCase();
    if (slugKey && slugCounts[slugKey] > 1) {
      addIssue(item.issues, 'DUPLICATE_SLUG', 'slug', 'error', 'Slug is used by more than one product.', item.slug, 'Set a unique slug.');
    }
    item.issueCount = item.issues.length;
    return item;
  }).filter((item) => item.issues.length > 0);
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
