import { parseJson, toIsoString } from './dbHelpers';

export type InterestSource = 'cart' | 'favorite';

export type RawInterestRow = {
  user_id: string | number;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  items?: unknown;
  updated_at?: unknown;
};

export type RawOrderInterestRow = {
  user_id: string | number | null;
  items?: unknown;
};

export type CustomerInterestItem = {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedPieces?: string;
  status: InterestSource;
  updatedAt?: string;
};

export type CustomerInterest = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  statuses: InterestSource[];
  products: CustomerInterestItem[];
  updatedAt?: string;
};

const getProductId = (item: any) =>
  String(item?.productId ?? item?.id ?? item?._id ?? item?.product?.id ?? item?.product?._id ?? '').trim();

const getProductName = (item: any) =>
  String(item?.name ?? item?.product?.name ?? 'Product').trim() || 'Product';

const getProductImage = (item: any) =>
  String(item?.image ?? item?.product?.image ?? '').trim();

const getProductPrice = (item: any) => {
  const value = Number(item?.price ?? item?.product?.price ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const getQuantity = (item: any, source: InterestSource) => {
  const value = Number(item?.quantity ?? (source === 'favorite' ? 1 : 0));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const orderedProductKey = (userId: unknown, productId: unknown) =>
  `${String(userId ?? '').trim()}::${String(productId ?? '').trim()}`;

export const buildOrderedProductSet = (orders: RawOrderInterestRow[]) => {
  const ordered = new Set<string>();
  for (const order of orders || []) {
    const userId = String(order?.user_id ?? '').trim();
    if (!userId) continue;
    const items = parseJson<any[]>(order.items, []);
    for (const item of items) {
      const productId = getProductId(item);
      if (productId) ordered.add(orderedProductKey(userId, productId));
    }
  }
  return ordered;
};

export const mergeCustomerInterestRows = (
  rowsBySource: Array<{ source: InterestSource; rows: RawInterestRow[] }>,
  orderedProducts: Set<string>
) => {
  const byUser = new Map<string, CustomerInterest>();

  for (const group of rowsBySource) {
    for (const row of group.rows || []) {
      const userId = String(row?.user_id ?? '').trim();
      if (!userId) continue;

      const rawItems = parseJson<any[]>(row.items, []);
      const availableItems = rawItems.filter((item) => {
        const productId = getProductId(item);
        return productId && !orderedProducts.has(orderedProductKey(userId, productId));
      });
      if (!availableItems.length) continue;

      const updatedAt = toIsoString(row.updated_at) || undefined;
      const existing: CustomerInterest = byUser.get(userId) || {
        userId,
        name: String(row.user_name || 'Customer'),
        email: String(row.user_email || ''),
        phone: String(row.user_phone || ''),
        statuses: [] as InterestSource[],
        products: [] as CustomerInterestItem[],
        updatedAt,
      };

      if (!existing.statuses.includes(group.source)) existing.statuses.push(group.source);
      if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) existing.updatedAt = updatedAt;

      for (const item of availableItems) {
        const productId = getProductId(item);
        const sameProductStatus = existing.products.find(
          (product) => product.productId === productId && product.status === group.source
        );
        if (sameProductStatus) {
          sameProductStatus.quantity += getQuantity(item, group.source);
          continue;
        }

        existing.products.push({
          productId,
          name: getProductName(item),
          image: getProductImage(item),
          price: getProductPrice(item),
          quantity: getQuantity(item, group.source),
          selectedSize: item?.selectedSize ?? item?.product?.selectedSize,
          selectedPieces: item?.selectedPieces ?? item?.product?.selectedPieces,
          status: group.source,
          updatedAt,
        });
      }

      byUser.set(userId, existing);
    }
  }

  return Array.from(byUser.values())
    .filter((entry) => entry.products.length > 0)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
};
