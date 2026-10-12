import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Headphones, PackageCheck, ReceiptText, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/formatPrice';

type OrderSuccessItem = {
  name?: string;
  quantity?: number | string;
  image?: string;
};

type OrderSuccessCardProps = {
  orderId?: string | number | null;
  amount?: number | null;
  method?: string | null;
  paymentId?: string | null;
  trackingId?: string | null;
  estimatedDelivery?: string | null;
  items?: OrderSuccessItem[] | null;
  secureLabel?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const copyText = (value?: string | number | null) => {
  if (!value) return;
  navigator.clipboard.writeText(String(value));
  toast.success('Copied');
};

const timeline = [
  { icon: CheckCircle2, title: 'Order confirmed', text: 'Your order is safely recorded.' },
  { icon: PackageCheck, title: 'Careful packing', text: 'Items are checked before dispatch.' },
  { icon: Truck, title: 'Shipping update', text: 'Tracking appears after dispatch.' },
];

const OrderSuccessCard = ({
  orderId,
  amount,
  method,
  paymentId,
  trackingId,
  estimatedDelivery,
  items,
  secureLabel = 'Verified BrajMart order confirmation',
}: OrderSuccessCardProps) => {
  const visibleItems = Array.isArray(items) ? items.slice(0, 3) : [];
  const deliveryDate = formatDate(estimatedDelivery);
  const trackHref = orderId ? `/track-order?orderId=${encodeURIComponent(String(orderId))}` : '/track-orders';
  const paymentText = amount === null || amount === undefined ? 'Confirmed' : formatPrice(amount);
  const detailCards = [
    {
      icon: ReceiptText,
      label: 'Order ID',
      value: orderId || 'Confirmed',
      note: 'Use this for tracking and support.',
      copyValue: orderId,
    },
    {
      icon: ShieldCheck,
      label: 'Payment',
      value: paymentText,
      note: `${method || 'Order payment'}${paymentId ? ` - ${paymentId}` : ''}`,
    },
    {
      icon: Truck,
      label: 'Delivery',
      value: deliveryDate || '3-7 business days',
      note: trackingId ? `Tracking ID: ${trackingId}` : 'Tracking updates appear after dispatch.',
    },
    {
      icon: Headphones,
      label: 'Support',
      value: 'Order help ready',
      note: 'Keep your Order ID for help requests or returns.',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_14px_45px_rgba(87,52,31,0.08)]">
        <div className="border-b border-border bg-[linear-gradient(180deg,#fff9ef_0%,#fffdf8_100%)] px-4 py-5 text-center sm:px-8 sm:py-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-tulsi/25 bg-white text-tulsi shadow-sm sm:h-16 sm:w-16">
            <CheckCircle2 size={34} className="sm:h-10 sm:w-10" />
          </div>
          <div className="mx-auto mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-tulsi/20 bg-white px-3 py-1.5 text-[11px] font-bold text-tulsi shadow-sm sm:text-xs">
            <ShieldCheck size={14} className="shrink-0" />
            <span className="min-w-0 truncate">{secureLabel}</span>
          </div>
          <h1 className="font-cinzel text-[1.75rem] font-bold leading-tight text-foreground sm:text-4xl">Thank you for your order</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Your BrajMart order has been confirmed. We will send updates as the order moves through packing, dispatch and delivery.
          </p>
          <div className="mx-auto mt-5 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to={trackHref} className="flex min-h-12 items-center justify-center rounded-lg bg-gold-gradient px-5 py-3 text-sm font-bold text-maroon-dark shadow-sm transition-transform active:scale-[0.98]">
              Track Order
            </Link>
            <Link to="/orders" className="flex min-h-12 items-center justify-center rounded-lg border border-border bg-white px-5 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted">
              My Orders
            </Link>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-border p-3 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {detailCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="rounded-lg border border-border bg-background p-3.5 sm:p-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
                      <Icon size={15} className="shrink-0" />
                      <span>{card.label}</span>
                    </div>
                    <div className="flex min-w-0 items-start gap-2">
                      <span className={`min-w-0 flex-1 break-words font-bold leading-snug ${card.label === 'Order ID' ? 'font-mono text-base text-saffron sm:text-lg' : 'text-base text-foreground sm:text-lg'}`}>
                        {card.value}
                      </span>
                      {card.copyValue && (
                        <button
                          type="button"
                          onClick={() => copyText(card.copyValue)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Copy ${card.label}`}
                        >
                          <Copy size={15} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{card.note}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-3 sm:gap-3">
              {timeline.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3 sm:block">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-saffron shadow-sm sm:mb-2">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:mt-1">{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="bg-white/45 p-3 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Receipt</p>
                <h2 className="font-cinzel text-lg font-bold text-foreground sm:text-xl">Order items</h2>
              </div>
              {items && items.length > 3 && (
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  +{items.length - 3} more
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2.5 sm:space-y-3">
              {visibleItems.length > 0 ? visibleItems.map((item, index) => (
                <div key={`${item.name || 'item'}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-2.5 shadow-sm">
                  {item.image ? (
                    <img src={item.image} alt={item.name || 'Order item'} className="h-14 w-14 shrink-0 rounded-md border border-border object-cover sm:h-12 sm:w-12" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-brand-soft text-saffron sm:h-12 sm:w-12">
                      <ShoppingBag size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.name || 'BrajMart item'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Qty {item.quantity || 1}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                  Your order details are saved securely. Track the order for the latest status.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <Link to={trackHref} className="flex min-h-12 items-center justify-center rounded-lg bg-gold-gradient px-5 py-3 text-sm font-bold text-maroon-dark shadow-sm transition-transform active:scale-[0.98]">
                Track Order
              </Link>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/orders" className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-3 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted">
                  My Orders
                </Link>
                <Link to="/" className="flex min-h-11 items-center justify-center rounded-lg border border-maroon/25 bg-card px-3 py-2.5 text-center text-sm font-semibold text-maroon hover:bg-brand-soft">
                  Shop More
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessCard;
