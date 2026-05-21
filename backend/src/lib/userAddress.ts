import { dbExecute } from './db';

type AnyAddress = {
  fullName?: string;
  mobile?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  [key: string]: any;
};

const cleanString = (value: any) => {
  const v = String(value ?? '').trim();
  return v ? v : '';
};

export const upsertUserDefaultAddress = async (userId: number, address: AnyAddress) => {
  if (!Number.isFinite(userId) || userId <= 0) return;
  if (!address || typeof address !== 'object') return;

  const fullName = cleanString(address.fullName);
  const mobile = cleanString(address.mobile);

  const addresses = [
    {
      ...address,
      fullName,
      mobile,
      street: cleanString(address.street),
      city: cleanString(address.city),
      state: cleanString(address.state),
      pincode: cleanString(address.pincode),
      isDefault: true,
    },
  ];

  // Keep existing email intact. Best-effort sync name/phone + default address for future checkouts.
  await dbExecute(
    'UPDATE users SET name = COALESCE(NULLIF(?, \'\'), name), phone = COALESCE(NULLIF(?, \'\'), phone), addresses = ?, updated_at = NOW() WHERE id = ?',
    [fullName, mobile, JSON.stringify(addresses), userId]
  );
};

