const DUMMY_TEXT_PATTERN = /^(test|testing|demo|dummy|fake|sample|asdf|qwerty|abc|abcd|aaaa|xxxxx|none|null|unknown|na|n\/a)$/i;
const DUMMY_EMAIL_PATTERN = /@(example\.com|test\.com|fake\.com|dummy\.com)$/i;

const INDIA_STATES = new Set([
  'andhra pradesh',
  'arunachal pradesh',
  'assam',
  'bihar',
  'chhattisgarh',
  'goa',
  'gujarat',
  'haryana',
  'himachal pradesh',
  'jharkhand',
  'karnataka',
  'kerala',
  'madhya pradesh',
  'maharashtra',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'odisha',
  'punjab',
  'rajasthan',
  'sikkim',
  'tamil nadu',
  'telangana',
  'tripura',
  'uttar pradesh',
  'uttarakhand',
  'west bengal',
  'andaman and nicobar islands',
  'chandigarh',
  'dadra and nagar haveli and daman and diu',
  'delhi',
  'jammu and kashmir',
  'ladakh',
  'lakshadweep',
  'puducherry',
]);

export const cleanCheckoutText = (value: unknown) =>
  String(value || '').trim().replace(/\s+/g, ' ');

const isRepeatedCharacters = (value: string) => /^([a-z0-9])\1+$/i.test(value.replace(/\s+/g, ''));

const isDummyText = (value: unknown) => {
  const cleaned = cleanCheckoutText(value);
  return !cleaned || DUMMY_TEXT_PATTERN.test(cleaned) || isRepeatedCharacters(cleaned);
};

export const isValidCheckoutEmail = (value: unknown) => {
  const email = cleanCheckoutText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !DUMMY_EMAIL_PATTERN.test(email);
};

const isValidIndianMobile = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits) && !isRepeatedCharacters(digits);
};

const isValidPincode = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digits) && !isRepeatedCharacters(digits) && digits !== '123456';
};

export const normalizeCheckoutAddress = (address: any = {}) => ({
  ...address,
  fullName: cleanCheckoutText(address.fullName),
  mobile: String(address.mobile || '').replace(/\D/g, ''),
  street: cleanCheckoutText(address.street),
  addressLine2: cleanCheckoutText(address.addressLine2),
  city: cleanCheckoutText(address.city),
  state: cleanCheckoutText(address.state),
  pincode: String(address.pincode || '').replace(/\D/g, ''),
  email: cleanCheckoutText(address.email).toLowerCase(),
});

export const validateCheckoutAddress = (address: any, section: 'Shipping' | 'Billing') => {
  const normalized = normalizeCheckoutAddress(address);
  if (isDummyText(normalized.fullName) || normalized.fullName.length < 3 || /\d/.test(normalized.fullName)) {
    return { ok: false as const, message: `${section}: enter the customer's real full name` };
  }
  if (isDummyText(normalized.street) || normalized.street.length < 10) {
    return { ok: false as const, message: `${section}: enter a complete Address Line 1 for parcel delivery` };
  }
  if (isDummyText(normalized.city) || normalized.city.length < 2 || /\d/.test(normalized.city)) {
    return { ok: false as const, message: `${section}: enter a valid city name` };
  }
  if (!INDIA_STATES.has(normalized.state.toLowerCase())) {
    return { ok: false as const, message: `${section}: select a valid Indian state` };
  }
  if (!isValidPincode(normalized.pincode)) {
    return { ok: false as const, message: `${section}: enter a valid 6 digit delivery pincode` };
  }
  if (!isValidIndianMobile(normalized.mobile)) {
    return { ok: false as const, message: `${section}: enter a valid 10 digit Indian mobile number` };
  }
  if (normalized.email && !isValidCheckoutEmail(normalized.email)) {
    return { ok: false as const, message: `${section}: enter a real email address for order updates` };
  }
  return { ok: true as const, address: normalized };
};

export const validateCheckoutOrderContact = (order: any, customerEmail: string) => {
  if (!isValidCheckoutEmail(customerEmail)) {
    return { ok: false as const, message: 'Enter a real customer email' };
  }

  const shipping = validateCheckoutAddress(order?.shippingAddress, 'Shipping');
  if (!shipping.ok) return shipping;
  const billing = validateCheckoutAddress(order?.billingAddress || order?.shippingAddress, 'Billing');
  if (!billing.ok) return billing;

  return {
    ok: true as const,
    shippingAddress: { ...shipping.address, email: shipping.address.email || customerEmail },
    billingAddress: { ...billing.address, email: billing.address.email || customerEmail },
  };
};
