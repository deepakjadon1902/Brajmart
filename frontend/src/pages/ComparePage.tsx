import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Plus, X, ArrowRight } from 'lucide-react';
import { getAllProducts } from '@/data/productCatalog';
import { formatPrice } from '@/utils/formatPrice';
import { Link } from 'react-router-dom';

const ComparePage = () => {
  const allProducts = getAllProducts();
  const [selected, setSelected] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const products = allProducts.filter(p => selected.includes(p.id));

  const addProduct = (id: string) => {
    if (selected.length < 4 && !selected.includes(id)) {
      setSelected([...selected, id]);
    }
    setShowPicker(false);
  };

  const removeProduct = (id: string) => setSelected(selected.filter(s => s !== id));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">SIDE BY SIDE</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Compare Products</h1>
            <p className="text-primary-foreground/70 max-w-xl mx-auto">Select up to 4 products to compare features, prices, and ratings.</p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {/* Product slots */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[0, 1, 2, 3].map(i => {
              const product = products[i];
              return (
                <div key={i} className="bg-card rounded-2xl border border-border p-4 min-h-[260px] flex flex-col items-center justify-center relative">
                  {product ? (
                    <>
                      <button onClick={() => removeProduct(product.id)} className="absolute top-3 right-3 w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"><X size={14} /></button>
                      <img src={product.image} alt={product.name} className="w-24 h-24 object-cover rounded-xl mb-3" />
                      <h3 className="font-semibold text-foreground text-sm text-center line-clamp-2 mb-1">{product.name}</h3>
                      <p className="text-saffron font-bold text-sm">{formatPrice(product.price)}</p>
                      {product.originalPrice && <p className="text-muted-foreground text-xs line-through">{formatPrice(product.originalPrice)}</p>}
                    </>
                  ) : (
                    <button onClick={() => setShowPicker(true)} className="flex flex-col items-center gap-2 text-muted-foreground hover:text-saffron transition-colors">
                      <div className="w-14 h-14 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                        <Plus size={24} />
                      </div>
                      <span className="text-xs font-medium">Add Product</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comparison Table */}
          {products.length >= 2 && (
            <ScrollReveal>
              <div className="bg-card rounded-2xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: 'Price', fn: (p: any) => formatPrice(p.price) },
                      { label: 'Rating', fn: (p: any) => `⭐ ${p.rating} (${p.reviews} reviews)` },
                      { label: 'Category', fn: (p: any) => p.category },
                      { label: 'Availability', fn: (p: any) => p.inStock ? '✅ In Stock' : '❌ Out of Stock' },
                      { label: 'Discount', fn: (p: any) => p.originalPrice ? `Save ${formatPrice(p.originalPrice - p.price)}` : 'No discount' },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-border/50">
                        <td className="py-4 px-4 font-medium text-foreground bg-pearl whitespace-nowrap">{row.label}</td>
                        {products.map(p => (
                          <td key={p.id} className="py-4 px-4 text-muted-foreground text-center">{row.fn(p)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollReveal>
          )}

          {products.length < 2 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Select at least 2 products to compare.</p>
              <button onClick={() => setShowPicker(true)} className="mt-4 px-6 py-2.5 rounded-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
                Browse Products
              </button>
            </div>
          )}

          {/* Picker modal */}
          {showPicker && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowPicker(false)} />
              <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto bg-card rounded-2xl border border-border p-6 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-cinzel font-bold text-foreground">Select a Product</h3>
                  <button onClick={() => setShowPicker(false)} className="text-muted-foreground"><X size={20} /></button>
                </div>
                <div className="space-y-2">
                  {allProducts.filter(p => !selected.includes(p.id)).slice(0, 20).map(p => (
                    <button key={p.id} onClick={() => addProduct(p.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left">
                      <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-saffron font-semibold">{formatPrice(p.price)}</p>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ComparePage;
