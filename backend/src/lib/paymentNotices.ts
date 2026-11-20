import { parseJson } from './dbHelpers';
import { getEtaConfig, getEtaText } from './eta';
import { sendAdminPaymentNotice, sendOrderConfirmation, sendPaymentFailed, sendPaymentReceipt } from './email';

const getOrderDetails = (orderRow: any) => ({
  items: parseJson(orderRow.items, []),
  total: Number(orderRow.total),
  itemsSubtotal: orderRow.items_subtotal == null ? undefined : Number(orderRow.items_subtotal),
  shippingAmount: orderRow.shipping_amount == null ? undefined : Number(orderRow.shipping_amount),
  packagingAmount: orderRow.packaging_amount == null ? undefined : Number(orderRow.packaging_amount),
  packagingRate: orderRow.packaging_rate == null ? undefined : Number(orderRow.packaging_rate),
  codAmount: orderRow.cod_amount == null ? undefined : Number(orderRow.cod_amount),
  codAvailable: orderRow.cod_available == null ? undefined : Boolean(Number(orderRow.cod_available)),
  codPincode: orderRow.cod_pincode ?? undefined,
  codMessage: orderRow.cod_message ?? undefined,
  couponCode: orderRow.coupon_code ?? undefined,
  couponDiscount: orderRow.coupon_discount == null ? undefined : Number(orderRow.coupon_discount),
  couponDetails: parseJson(orderRow.coupon_details, null),
  paymentMethod: orderRow.payment_method,
  shippingAddress: parseJson(orderRow.shipping_address, {}),
  billingAddress: parseJson(orderRow.billing_address, {}),
});

export const sendPaymentOutcomeNotices = async (orderRow: any, status: 'paid' | 'failed', transactionId: string, method: string, amount: number) => {
  const details = getOrderDetails(orderRow);
  const { min, max } = await getEtaConfig();
  const etaText = getEtaText(min, max);

  if (orderRow.customer_email) {
    if (status === 'paid') {
      sendOrderConfirmation(orderRow.customer_email, {
        orderId: String(orderRow.id),
        itemsCount: details.items.length || 0,
        eta: etaText,
        ...details,
      }).catch(() => {});
      sendPaymentReceipt(orderRow.customer_email, {
        orderId: String(orderRow.id),
        amount,
        paymentId: transactionId,
        eta: etaText,
        details,
      }).catch((err) => console.error('Payment invoice email failed', { orderId: String(orderRow.id), message: err?.message || err }));
    } else {
      sendPaymentFailed(orderRow.customer_email, {
        orderId: String(orderRow.id),
        amount,
        paymentId: transactionId,
        eta: etaText,
        details,
      }).catch(() => {});
    }
  }

  sendAdminPaymentNotice({
    status,
    orderId: String(orderRow.id),
    amount,
    paymentId: transactionId,
    method,
    customerEmail: orderRow.customer_email,
  }).catch(() => {});
};
