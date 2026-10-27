export const formatPrice = (price: number | string | null | undefined): string => {
  if (price === null || price === undefined || (typeof price === 'string' && !price.trim())) {
    return 'Not available';
  }
  const amount = Number(price);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : 'Not available';
};

export const calculateDiscount = (price: number, originalPrice: number): number => {
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};
