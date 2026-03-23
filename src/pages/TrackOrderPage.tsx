import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Search, Package, CheckCircle2, Truck, MapPin, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const mockOrder = {
  id: 'BM-2025-78432',
  date: 'Mar 18, 2025',
  status: 'shipped',
  eta: 'Mar 23, 2025',
  items: [
    { name: 'Vrindavan Ladoo Prasadam (500g)', qty: 2, price: 319 },
    { name: 'Tulsi Kanti Mala — Premium', qty: 1, price: 449 },
  ],
  total: 1087,
};

const steps = [
  { key: 'placed', label: 'Order Placed', icon: Package, time: 'Mar 18, 10:34 AM' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, time: 'Mar 18, 11:00 AM' },
  { key: 'shipped', label: 'Shipped', icon: Truck, time: 'Mar 19, 2:15 PM' },
  { key: 'out', label: 'Out for Delivery', icon: MapPin, time: '' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, time: '' },
];

const statusIdx: Record<string, number> = { placed: 0, confirmed: 1, shipped: 2, out: 3, delivered: 4 };

const TrackOrderPage = () => {
  const { toast } = useToast();
  const [orderId, setOrderId] = useState('');
  const [tracked, setTracked] = useState(false);
  const currentStep = statusIdx[mockOrder.status] ?? 0;

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) { toast({ title: 'Please enter an Order ID', variant: 'destructive' }); return; }
    setTracked(true);
    toast({ title: 'Order Found! 📦' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">ORDER TRACKING</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-6">Track Your Order</h1>
            <form onSubmit={handleTrack} className="max-w-lg mx-auto flex rounded-full border border-primary-foreground/20 overflow-hidden bg-primary-foreground/5">
              <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="Enter Order ID (e.g., BM-2025-78432)" className="flex-1 px-5 py-3 bg-transparent text-sm outline-none placeholder:text-primary-foreground/40" />
              <button type="submit" className="px-6 bg-gold-gradient text-maroon-dark font-bold text-sm shimmer"><Search size={18} /></button>
            </form>
          </ScrollReveal>
        </div>
      </section>

      {tracked && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <ScrollReveal>
              {/* Timeline */}
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-cinzel text-lg font-bold text-foreground">Order #{mockOrder.id}</h2>
                  <span className="text-xs text-muted-foreground">{mockOrder.date}</span>
                </div>
                <div className="flex items-center gap-2 mb-8">
                  <Clock size={14} className="text-saffron" />
                  <span className="text-sm text-muted-foreground">Estimated delivery: <strong className="text-foreground">{mockOrder.eta}</strong></span>
                </div>

                <div className="relative">
                  {/* Progress bar */}
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-border">
                    <div className="h-full bg-saffron transition-all duration-700" style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }} />
                  </div>
                  <div className="flex justify-between relative">
                    {steps.map((s, i) => {
                      const done = i <= currentStep;
                      return (
                        <div key={s.key} className="flex flex-col items-center text-center w-1/5">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 transition-colors ${done ? 'bg-saffron border-saffron text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                            <s.icon size={16} />
                          </div>
                          <span className={`text-[0.65rem] mt-2 font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                          {s.time && <span className="text-[0.55rem] text-muted-foreground">{s.time}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Order Items</h3>
                <div className="space-y-3">
                  {mockOrder.items.map(item => (
                    <div key={item.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                      </div>
                      <p className="text-sm font-semibold text-saffron">₹{item.price * item.qty}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 pt-3 border-t border-border">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-saffron text-lg">₹{mockOrder.total}</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default TrackOrderPage;
