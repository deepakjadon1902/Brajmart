export const formatPrice = (price: number): string => {
  return `₹${price.toLocaleString('en-IN')}`;
};

export const calculateDiscount = (price: number, originalPrice: number): number => {
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};
