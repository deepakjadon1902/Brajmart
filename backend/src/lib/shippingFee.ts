const DEFAULT_SHIPPING_FEE = 69;

export const parseShippingFee = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99) return undefined;
  return Math.round(amount * 100) / 100 === amount ? amount : undefined;
};

export const getShippingFee = (value: unknown): number => parseShippingFee(value) ?? DEFAULT_SHIPPING_FEE;
