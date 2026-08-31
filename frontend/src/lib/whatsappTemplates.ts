export const BRAJMART_CONTACT_PHONE_DISPLAY = '+91 96343 59003';
export const BRAJMART_SITE_URL = 'https://www.brajmart.com/';
export const BRAJMART_WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCLKSwFy72HcIUcXy0u';
export const BRAJMART_INSTAGRAM_URL = 'https://www.instagram.com/brajmart_official/';
export const BRAJMART_GOOGLE_REVIEW_URL = 'https://g.page/r/CcB_tRBxPC-NEBM/review';

const PRAYER_HANDS = '\u{1F64F}';
const POINT_RIGHT = '\u{1F449}';
const SEPARATOR = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

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

const getFirstName = (name: string) => cleanLine(name).split(/\s+/)[0] || 'Customer';

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
  const firstName = getFirstName(customerName);
  const orderId = getOrderId(order);
  const trackingLookup = cleanLine(order.trackingId || orderId);
  const trackingLink = getPublicUrl(`/track-orders?orderId=${encodeURIComponent(trackingLookup)}`);
  const extraNote = cleanLine(note);

  return [
    `${PRAYER_HANDS} Hare Krishna Dear ${firstName},`,
    '',
    `Your BrajMart order #${orderId} has been successfully dispatched and shipped.`,
    '',
    `Your Order Tracking Number is: ${cleanLine(order.trackingId) || '-'}`,
    `Shipping Provider: ${cleanLine(order.shippingService) || '-'}`,
    '',
    'You can track your order here:',
    trackingLink,
    '',
    'It will be delivered to you shortly.',
    extraNote ? `Note: ${extraNote}` : '',
    '',
    SEPARATOR,
    '',
    'Thank you for choosing BrajMart and for bringing the devotion and flavours of Vrindavan Dham to your home.',
    '',
    'Want to explore more from the sacred land of Vrindavan Dham?',
    `Visit ${BRAJMART_SITE_URL} and discover our collection of devotional products, prasadam and Vrindavan specialties.`,
    '',
    SEPARATOR,
    '',
    'We would love to stay connected with you.',
    '',
    'Exclusive offers & latest updates:',
    BRAJMART_WHATSAPP_CHANNEL_URL,
    '',
    'Follow us on Instagram:',
    BRAJMART_INSTAGRAM_URL,
    '',
    'Enjoyed your BrajMart experience?',
    'We would be grateful for your review:',
    BRAJMART_GOOGLE_REVIEW_URL,
    '',
    SEPARATOR,
    '',
    'For any assistance, please contact us:',
    BRAJMART_CONTACT_PHONE_DISPLAY,
    '',
    'Thank you once again for shopping with BrajMart.',
    `Hare Krishna ${PRAYER_HANDS}`,
    '',
    'Yours faithfully,',
    'BrajMart Team',
    'From Vrindavan Dham',
    'All glories to Sri Sri Radha Shyam Sunder!',
  ].filter((line) => line !== '').join('\n');
};

export const buildPendingPaymentWhatsAppMessage = (order: OrderLike) => {
  const customerName = getCustomerName(order);
  const address = getAddress(order);
  const orderId = getOrderId(order);
  const paymentToken = cleanLine(order.paymentToken);
  const paymentLink = paymentToken ? getPublicUrl(`/payment-status/${encodeURIComponent(paymentToken)}`) : '';

  return [
    `${PRAYER_HANDS} Hare Krishna Dear ${customerName},`,
    `Your BrajMart order #${orderId} is waiting for payment completion.`,
    '',
    'PAYMENT PENDING DETAILS',
    `Amount Pending: ${formatCurrency(order.total)}`,
    `Payment Method: ${cleanLine(order.paymentMethod) || 'Online Payment'}`,
    `Payment Status: ${cleanLine(order.paymentStatus) || 'pending'}`,
    `Order Date: ${formatDate(order.createdAt)}`,
    paymentLink ? 'Complete / check your payment here:' : '',
    paymentLink ? `${POINT_RIGHT} ${paymentLink}` : '',
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
    SEPARATOR,
    'STAY CONNECTED WITH BRAJMART',
    SEPARATOR,
    'Exclusive offers & latest updates:',
    BRAJMART_WHATSAPP_CHANNEL_URL,
    '',
    'Follow us on Instagram:',
    BRAJMART_INSTAGRAM_URL,
    '',
    'For any assistance, contact us:',
    BRAJMART_CONTACT_PHONE_DISPLAY,
    '',
    `Hare Krishna ${PRAYER_HANDS}`,
    'BrajMart Team',
    'From the Sacred Land of Vrindavan Dham',
  ].filter((line) => line !== '').join('\n');
};
