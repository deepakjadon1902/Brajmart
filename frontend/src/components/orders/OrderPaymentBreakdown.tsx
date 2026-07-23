import { formatPrice } from '@/utils/formatPrice';

interface OrderPaymentBreakdownProps {
  itemsSubtotal?: number;
  shippingAmount?: number;
  packagingAmount?: number;
  packagingRate?: number;
  codAmount?: number;
  codPincode?: string;
  total: number;
  calculatedItemsSubtotal?: number;
  paymentMethod?: string;
}

export function OrderPaymentBreakdown({ itemsSubtotal, packagingAmount, packagingRate, shippingAmount, codAmount, codPincode, total, calculatedItemsSubtotal, paymentMethod }: OrderPaymentBreakdownProps) {
  const subtotal = itemsSubtotal ?? calculatedItemsSubtotal ?? total;
  const hasExactBreakdown = shippingAmount !== undefined || packagingAmount !== undefined || codAmount !== undefined;
  const codCharge = Number(codAmount || 0);
  const legacyAdjustment = hasExactBreakdown ? 0 : Math.max(0, total - subtotal);

  return (
    <div className="mt-4 border-t border-border pt-3 text-sm">
      <div className="space-y-2" aria-label="Payment breakdown">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Product price</span><span>{formatPrice(subtotal)}</span></div>
        {hasExactBreakdown ? <>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Packaging cost{packagingRate ? ` (${packagingRate}%)` : ''}</span><span>{formatPrice(Number(packagingAmount || 0))}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Shipping charge</span><span className={Number(shippingAmount || 0) === 0 ? 'font-medium text-tulsi' : ''}>{Number(shippingAmount || 0) === 0 ? 'FREE' : formatPrice(Number(shippingAmount))}</span></div>
          {codCharge > 0 && <div className="flex justify-between gap-4"><span className="text-muted-foreground">COD Handle Fee{codPincode ? ` (${codPincode})` : ''}</span><span>{formatPrice(codCharge)}</span></div>}
        </> : legacyAdjustment > 0 ? <div className="flex justify-between gap-4"><span className="text-muted-foreground">Packaging &amp; shipping</span><span>{formatPrice(legacyAdjustment)}</span></div> : null}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-base"><span className="font-semibold">Order total</span><span className="font-bold text-saffron">{formatPrice(total)}</span></div>
      </div>
      {paymentMethod && <p className="mt-2 text-xs text-muted-foreground">Payment method: <span className="font-medium text-foreground">{paymentMethod}</span></p>}
    </div>
  );
}
