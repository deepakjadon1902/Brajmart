import { Truck } from 'lucide-react';
import { formatPrice } from '@/utils/formatPrice';

const FreeShippingProgress = ({ cartTotal, threshold }: { cartTotal: number; threshold: number }) => {
  if (!threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - cartTotal);
  const percentage = Math.min((cartTotal / threshold) * 100, 100);

  return (
    <div className="rounded-lg border border-[#CFE8D2] bg-[#F1FAF2] px-4 py-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[#2E7D32] shadow-sm">
          <Truck size={15} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[13px] font-bold text-[#2E7D32]">
            {remaining > 0 ? `Add ${formatPrice(Math.ceil(remaining))} more for free shipping` : 'Free shipping unlocked'}
          </p>
          <p className="text-[11px] text-[#4B6F4E]">Shipping is rechecked before payment.</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[#DCEBDD]">
        <div className="h-1.5 rounded-full bg-[#2E7D32] transition-[width] duration-300 ease-out" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export default FreeShippingProgress;
