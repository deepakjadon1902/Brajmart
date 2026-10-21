import type { Request } from 'express';
import { captureMetaOrderContext, sendVerifiedMetaPurchaseForOrder } from '../routes/metaConversions';
import { captureGoogleOrderContext, sendVerifiedGooglePurchaseForOrder } from './googlePurchases';

export const capturePurchaseOrderContext = async (orderId: string | number, context: unknown, req?: Request) => {
  await Promise.allSettled([captureMetaOrderContext(orderId, context, req), captureGoogleOrderContext(orderId, context)]);
};

// Provider failures must not prevent a verified payment from confirming an order.
export const sendVerifiedPurchaseForOrder = async (orderId: string | number, paymentId?: string, statusToken?: string) => {
  const results = await Promise.allSettled([
    sendVerifiedMetaPurchaseForOrder(orderId, paymentId, statusToken),
    sendVerifiedGooglePurchaseForOrder(orderId, paymentId, statusToken),
  ]);
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error(`${index === 0 ? 'Meta' : 'Google'} verified purchase delivery failed; retry with the same order ID.`);
  });
  return results;
};
