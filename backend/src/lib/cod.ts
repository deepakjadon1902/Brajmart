import { checkDeliveryServicePincode, getCodEligibilityForItems } from './deliveryService';

export const resolveCodHandleFee = async (
  order: any,
  settings: { codEnabled?: boolean; codFee?: number }
) => {
  const requested = Boolean(order?.codRequested) || Number(order?.codAmount || 0) > 0;
  if (!requested) {
    return { amount: 0, available: null as boolean | null, pincode: null as string | null, message: null as string | null };
  }
  const deliveryPincode = String(order?.shippingAddress?.pincode || order?.billingAddress?.pincode || '').trim();
  if (!/^\d{6}$/.test(deliveryPincode)) {
    throw new Error('A valid 6 digit delivery pincode is required for COD Handle Fee');
  }

  const eligibility = await getCodEligibilityForItems(Array.isArray(order?.items) ? order.items : []);
  if (!eligibility.eligible) {
    throw new Error(eligibility.message);
  }

  const delivery = await checkDeliveryServicePincode({ desPincode: deliveryPincode });
  const available = Boolean(delivery.serviceable && delivery.codAvailable);
  const message = delivery.message || (available ? 'COD available for this pincode' : 'COD not available for this pincode');
  if (!available) {
    throw new Error(message || 'COD is not available for this pincode');
  }

  return {
    amount: Math.max(0, Number(settings.codFee ?? 40) || 0),
    available,
    pincode: deliveryPincode,
    message,
  };
};
