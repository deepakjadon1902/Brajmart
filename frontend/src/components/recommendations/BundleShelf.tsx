import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ProductCard from '@/components/product/ProductCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { CommerceBundle } from '@/lib/api';
import { trackMetaPixelEvent, productToMetaPixelParams } from '@/lib/metaPixel';
import { useCartStore } from '@/store/cartStore';
import { Product } from '@/types/product';
import { formatPrice } from '@/utils/formatPrice';

type BundleShelfProps = {
  bundles: CommerceBundle[];
  title?: string;
  subtitle?: string;
};

const BundleShelf = ({ bundles, title = 'Complete the Collection', subtitle = 'Admin-curated sets built from currently available products.' }: BundleShelfProps) => {
  const addItem = useCartStore((state) => state.addItem);
  const openCartDrawer = useCartStore((state) => state.openDrawer);
  const navigate = useNavigate();
  const bundle = bundles.find((item) => item.products?.length >= 2);
  if (!bundle) return null;
  const products = bundle.products.slice(0, 5) as Product[];

  const saveBundleSnapshot = () => {
    try {
      sessionStorage.setItem('brajmart-last-bundle', JSON.stringify({
        name: bundle.name,
        total: bundle.bundlePrice,
        savings: bundle.savings || 0,
        products: products.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.price,
          image: product.image,
        })),
      }));
    } catch {
      // Cart validation remains authoritative even without this UI snapshot.
    }
  };

  const addBundle = () => {
    products.forEach((product) => {
      addItem(product);
      trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product));
    });
    saveBundleSnapshot();
    openCartDrawer(products[0]?.id);
    toast.success(`${bundle.name} added to cart`);
  };

  const buyBundle = () => {
    addBundle();
    navigate('/checkout');
  };

  return (
    <section className="bg-pearl py-6">
      <div className="storefront-shell">
        <SectionHeader tag="CURATED SET" title={title} subtitle={subtitle} />
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="font-playfair text-xl font-bold leading-tight text-foreground">{bundle.name}</h3>
            {bundle.description && <p className="mt-2 text-sm leading-5 text-muted-foreground">{bundle.description}</p>}
            <div className="mt-3 space-y-1.5">
              {products.map((product) => (
                <Link key={product.id} to={`/product/${product.slug}`} className="grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-md p-1 transition hover:bg-muted/60 premium-focus">
                  <img src={product.image} alt="" className="h-8 w-8 rounded border border-border bg-brand-raised object-contain p-0.5" />
                  <span className="min-w-0">
                    <span className="block line-clamp-1 text-xs font-semibold text-foreground">{product.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{product.category}</span>
                  </span>
                  <span className="text-xs font-bold text-foreground">{formatPrice(product.price)}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Set total</span>
                <span className="font-playfair text-xl font-bold text-saffron">{formatPrice(bundle.bundlePrice)}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={addBundle} className="min-h-10 rounded-lg border border-maroon bg-white px-3 text-xs font-bold text-maroon premium-focus">
                Add Set
              </button>
              <button type="button" onClick={buyBundle} className="min-h-10 rounded-lg bg-saffron px-3 text-xs font-bold text-white premium-focus">
                Buy Now
              </button>
            </div>
          </aside>
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3">
              {products.map((product) => (
                <div key={product.id} className="w-[250px] flex-none">
                  <ProductCard product={product} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BundleShelf;
