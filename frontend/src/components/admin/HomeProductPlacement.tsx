import type { Product } from '@/types/product';
import { categoryToSlug } from '@/store/productStore';
import { homePositionOf, pickHomeProducts } from '@/lib/homeProducts.mjs';
import { compareProductsByQuality } from '@/utils/productPresentation';

type Props = { product: Product; products: Product[]; onChange: (position: number | null) => void; disabled?: boolean; preview?: boolean };

export default function HomeProductPlacement({ product, products, onChange, disabled, preview }: Props) {
  const categoryProducts = products.filter((item) => categoryToSlug(item.category || '') === categoryToSlug(product.category || ''));
  const existing = pickHomeProducts(categoryProducts, compareProductsByQuality);
  const position = homePositionOf(product) ?? (product.showOnHome ? existing.findIndex((item: Product) => item.id === product.id) + 1 || null : null);
  const candidates = categoryProducts.filter((item) => item.id !== product.id).map((item) =>
    position && homePositionOf(item) === position ? { ...item, showOnHome: false, homePosition: null } : item);
  const selectedProducts = pickHomeProducts([...candidates, { ...product, homePosition: position, showOnHome: Boolean(position) }], compareProductsByQuality);
  const occupant = categoryProducts.find((item) => item.id !== product.id && homePositionOf(item) === position);

  return (
    <div className={preview ? 'space-y-3' : ''}>
      <select
        aria-label={`Home position for ${product.name || 'new product'}`}
        value={position || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 disabled:cursor-wait disabled:opacity-60 ${position ? 'border-amber-500/50 bg-slate-900 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300'} ${preview ? 'w-full' : 'w-32'}`}
      >
        <option value="">Automatic</option>
        {[1, 2, 3, 4, 5, 6].map((slot) => <option key={slot} value={slot}>Position {slot}</option>)}
      </select>
      {preview && <>
        <p className="text-xs leading-relaxed text-slate-400">Choose a position in {product.category || 'this category'}. Unassigned positions use the top products automatically. Automatic releases this product’s manual position.</p>
        {position && selectedProducts.length < position && <p className="text-xs text-amber-200">This category has {selectedProducts.length} products. Your selection appears last until enough products are available for position {position}.</p>}
        {occupant && <p className="text-xs text-amber-200">Saving replaces {occupant.name} at position {position}. It can still appear as an automatic pick.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Category home page preview">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const item = selectedProducts[index];
            const chosen = item?.id === product.id && Boolean(position);
            return <div key={index} className={`min-w-0 rounded-xl border p-3 ${chosen ? 'border-amber-500/60 bg-amber-500/10' : 'border-slate-800 bg-slate-900/50'}`}>
              <p className="text-xs font-semibold text-slate-400">Position {index + 1}</p>
              <p className="mt-1 truncate text-xs font-medium text-white" title={item?.name}>{item?.name || 'No product yet'}</p>
              <p className={`mt-1 text-[11px] ${chosen ? 'text-amber-200' : 'text-slate-500'}`}>{chosen ? 'Your selection' : item?.showOnHome ? 'Selected' : item ? 'Automatic' : 'Add more category products'}</p>
            </div>;
          })}
        </div>
        <p className="text-xs text-slate-500">Preview updates as you choose. Save Product to publish your changes.</p>
      </>}
    </div>
  );
}
