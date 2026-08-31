export const BRAJMART_CONTACT_PHONE_DISPLAY = '+91 96343 59003';
export const BRAJMART_WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCLKSwFy72HcIUcXy0u';
export const BRAJMART_INSTAGRAM_URL = 'https://www.instagram.com/brajmart_official/';
export const BRAJMART_GOOGLE_REVIEW_URL = 'https://g.page/r/CcB_tRBxPC-NEBM/review';

type AddressLike = {
  fullName?: string;
  mobile?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type ItemLike = {
  product?: {
    name?: string;
  };
  name?: string;
  price?: number | string;
  quantity?: number | string;
  selectedSize?: string;
  selectedPieces?: string;
};

type OrderLike = {
  _id?: string;
  id?: string | number;
  orderId?: string | number;
  items?: ItemLike[];
  total?: number | string;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  shippingAddress?: AddressLike;
  customerAddress?: AddressLike;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentToken?: string;
  trackingId?: string;
  shippingService?: string;
  createdAt?: string;
};

const cleanLine = (value: unknown) => String(value || '').trim();

export const normalizeWhatsAppPhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

export const buildWhatsAppWebUrl = (phone: string, message: string) =>
  `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

const formatCurrency = (value: unknown) =>
  `INR ${Number(value || 0).toLocaleString('en-IN')}`;

const formatDate = (value: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN');
};

const getPublicUrl = (path: string) => {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

const getOrderId = (order: OrderLike) => cleanLine(order.orderId || order.id || order._id || '-');

const getAddress = (order: OrderLike) => order.shippingAddress || order.customerAddress || {};

const getCustomerName = (order: OrderLike) =>
  cleanLine(getAddress(order).fullName || order.customerName || 'Customer');

export const getOrderWhatsAppPhone = (order: OrderLike) =>
  normalizeWhatsAppPhone(getAddress(order).mobile || order.customerPhone || order.phone);

const formatAddressLines = (address: AddressLike, fallbackName: string) => [
  cleanLine(address.fullName || fallbackName),
  cleanLine([address.street, address.city].filter(Boolean).join(', ')),
  cleanLine([address.state, address.pincode].filter(Boolean).join(' - ')),
  cleanLine(address.mobile),
].filter(Boolean);

const formatItemLines = (items?: ItemLike[]) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return ['-'];

  return list.map((item, index) => {
    const name = cleanLine(item.product?.name || item.name || 'Item');
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const options = [
      item.selectedSize ? `Size: ${item.selectedSize}` : '',
      item.selectedPieces,
    ].filter(Boolean);
    const optionText = options.length ? ` (${options.join(', ')})` : '';
    return `${index + 1}. ${name}${optionText}\n   Qty: ${qty}\n   Total: ${formatCurrency(price * qty)}`;
  });
};

export const buildDispatchedOrderWhatsAppMessage = (order: OrderLike, note?: string) => {
  const customerName = getCustomerName(order);
  const address = getAddress(order);
  const orderId = getOrderId(order);
  const trackingLookup = cleanLine(order.trackingId || orderId);
  const trackingLink = getPublicUrl(`/track-orders?orderId=${encodeURIComponent(trackingLookup)}`);
  const extraNote = cleanLine(note);

  return [
    `🙏 Hare Krishna Dear ${customerName},`,
    `Your BrajMart order #${orderId} has been dispatched and is now on its way to you.`,
    '',
    'ORDER DETAILS',
    `Tracking Number: ${cleanLine(order.trackingId) || '-'}`,
    `Shipping Partner: ${cleanLine(order.shippingService) || '-'}`,
    'Track your shipment:',
    `👉 ${trackingLink}`,
    '',
    'Your order will be delivered to you shortly.',
    extraNote ? `Note: ${extraNote}` : '',
    '',
    'ITEMS IN YOUR ORDER',
    ...formatItemLines(order.items),
    '',
    `Order Total: ${formatCurrency(order.total)}`,
    '',
    'SHIPPING ADDRESS',
    ...formatAddressLines(address, customerName),
    '',
    'Thank you for choosing BrajMart and for bringing a little piece of Vrindavan Dham into your home.',
    'May Sri Radha Krishna bless you and your family with peace, devotion and happiness.',
    '━━━━━━━━━━━━━━━━━━',
    'STAY CONNECTED WITH BRAJMART',
    '━━━━━━━━━━━━━━━━━━',
    'Exclusive offers & latest updates:',
    BRAJMART_WHATSAPP_CHANNEL_URL,
    '',
    'Follow us on Instagram:',
    BRAJMART_INSTAGRAM_URL,
    '',
    "We'd love to hear about your experience.",
    'Leave us a Google Review:',
    BRAJMART_GOOGLE_REVIEW_URL,
    '',
    'For any assistance, contact us:',
    BRAJMART_CONTACT_PHONE_DISPLAY,
    '',
    'Hare Krishna 🙏',
    'BrajMart Team',
    'From the Sacred Land of Vrindavan Dham',
  ].filter((line) => line !== '').join('\n');
};

export const buildPendingPaymentWhatsAppMessage = (order: OrderLike) => {
  const customerName = getCustomerName(order);
  const address = getAddress(order);
  const orderId = getOrderId(order);
  const paymentToken = cleanLine(order.paymentToken);
  const paymentLink = paymentToken ? getPublicUrl(`/payment-status/${encodeURIComponent(paymentToken)}`) : '';

  return [
    `🙏 Hare Krishna Dear ${customerName},`,
    `Your BrajMart order #${orderId} is waiting for payment completion.`,
    '',
    'PAYMENT PENDING DETAILS',
    `Amount Pending: ${formatCurrency(order.total)}`,
    `Payment Method: ${cleanLine(order.paymentMethod) || 'Online Payment'}`,
    `Payment Status: ${cleanLine(order.paymentStatus) || 'pending'}`,
    `Order Date: ${formatDate(order.createdAt)}`,
    paymentLink ? 'Complete / check your payment here:' : '',
    paymentLink ? `👉 ${paymentLink}` : '',
    '',
    'ITEMS PENDING IN YOUR ORDER',
    ...formatItemLines(order.items),
    '',
    `Order Total: ${formatCurrency(order.total)}`,
    '',
    'SHIPPING ADDRESS',
    ...formatAddressLines(address, customerName),
    '',
    'Kindly complete your payment so we can confirm and prepare your order for dispatch.',
    'If you have already paid, please reply here with your payment screenshot or transaction ID.',
    '━━━━━━━━━━━━━━━━━━',
    'STAY CONNECTED WITH BRAJMART',
    '━━━━━━━━━━━━━━━━━━',
    'Exclusive offers & latest updates:',
    BRAJMART_WHATSAPP_CHANNEL_URL,
    '',
    'Follow us on Instagram:',
    BRAJMART_INSTAGRAM_URL,
    '',
    'For any assistance, contact us:',
    BRAJMART_CONTACT_PHONE_DISPLAY,
    '',
    'Hare Krishna 🙏',
    'BrajMart Team',
    'From the Sacred Land of Vrindavan Dham',
  ].filter((line) => line !== '').join('\n');
};
