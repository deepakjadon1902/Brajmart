import { checkDtdcPincode } from './dtdc';

export const COD_HANDLE_FEE = 40;

export const resolveCodHandleFee = async (
  order: any,
  settings: { codEnabled?: boolean }
) => {
  const requested = Boolean(order?.codRequested) || Number(order?.codAmount || 0) > 0;
  if (!requested) {
    return { amount: 0, available: null as boolean | null, pincode: null as string | null, message: null as string | null };
  }
  if (!settings.codEnabled) {
    throw new Error('COD is currently disabled');
  }

  const deliveryPincode = String(order?.shippingAddress?.pincode || order?.billingAddress?.pincode || '').trim();
  if (!/^\d{6}$/.test(deliveryPincode)) {
    throw new Error('A valid 6 digit delivery pincode is required for COD Handle Fee');
  }

  const dtdc = await checkDtdcPincode({ desPincode: deliveryPincode });
  const available = Boolean(dtdc.serviceable && dtdc.codAvailable);
  const message = dtdc.message || (available ? 'COD available for this pincode' : 'COD not available for this pincode');
  if (!available) {
    throw new Error(message || 'COD is not available for this pincode');
  }

  return {
    amount: COD_HANDLE_FEE,
    available,
    pincode: deliveryPincode,
    message,
  };
};
