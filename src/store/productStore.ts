import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Category } from '@/types/product';

// Default seed data
const img = (seed: string) => `https://images.unsplash.com/photo-${seed}?w=400&h=400&fit=crop&auto=format`;

const defaultProducts: Product[] = [
  { id: 'p1', name: 'Vrindavan Temple Prasadam Box', slug: 'vrindavan-prasadam-box', price: 319, originalPrice: 699, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.8, reviewCount: 234, badge: 'new', inStock: true },
  { id: 'p2', name: 'ISKCON Mathura Peda Box', slug: 'iskcon-peda', price: 279, originalPrice: 549, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.9, reviewCount: 2341, badge: 'bestseller', inStock: true, soldCount: 847 },
  { id: 'p3', name: 'Banke Bihari Ladoo Box', slug: 'banke-bihari-ladoo', price: 349, originalPrice: 599, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.7, reviewCount: 189, inStock: true },
  { id: 'p4', name: 'Govind Dev Ji Misri Packet', slug: 'govind-dev-misri', price: 149, originalPrice: 299, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.6, reviewCount: 98, badge: 'new', inStock: true },
  { id: 'p5', name: 'Radha Raman Temple Churma', slug: 'radha-raman-churma', price: 399, originalPrice: 749, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.9, reviewCount: 312, inStock: true },
  { id: 'p6', name: 'Vrindavan Rose Petal Gulkand', slug: 'rose-petal-gulkand', price: 199, originalPrice: 399, image: img('1631209046498-fa72d4d4a5c3'), category: 'Prasadam', rating: 4.5, reviewCount: 156, inStock: true },
  { id: 'b1', name: 'Bhagavad Gita As It Is', slug: 'bhagavad-gita', price: 249, originalPrice: 499, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.9, reviewCount: 1823, badge: 'bestseller', inStock: true },
  { id: 'b2', name: 'Srimad Bhagavatam Set', slug: 'srimad-bhagavatam', price: 2499, originalPrice: 4999, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 5.0, reviewCount: 892, badge: 'bestseller', inStock: true, soldCount: 423 },
  { id: 'b3', name: 'Chaitanya Charitamrita', slug: 'chaitanya-charitamrita', price: 1899, originalPrice: 3499, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.8, reviewCount: 234, inStock: true },
  { id: 'b4', name: 'Science of Self-Realization', slug: 'science-self-realization', price: 179, originalPrice: 349, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.7, reviewCount: 567, badge: 'new', inStock: true },
  { id: 'b5', name: 'Krishna Book', slug: 'krishna-book', price: 299, originalPrice: 599, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.8, reviewCount: 345, inStock: true },
  { id: 'b6', name: 'Nectar of Devotion', slug: 'nectar-of-devotion', price: 219, originalPrice: 449, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.9, reviewCount: 278, inStock: true },
  { id: 'i1', name: 'Radha Krishna Brass Idol', slug: 'radha-krishna-idol', price: 1849, originalPrice: 3499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.9, reviewCount: 89, inStock: true },
  { id: 'i2', name: 'Laddu Gopal Shringar Set', slug: 'laddu-gopal-shringar', price: 749, originalPrice: 1499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.9, reviewCount: 234, badge: 'bestseller', inStock: true, soldCount: 167 },
  { id: 'i3', name: 'Brass Bal Gopal Murti — 4 inch', slug: 'bal-gopal-murti', price: 599, originalPrice: 1199, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.7, reviewCount: 134, inStock: true },
  { id: 'i4', name: 'Peacock Feather Crown Set', slug: 'peacock-crown', price: 349, originalPrice: 699, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.8, reviewCount: 87, badge: 'new', inStock: true },
  { id: 'i5', name: 'Deity Flute — Silver Plated', slug: 'deity-flute', price: 249, originalPrice: 499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.6, reviewCount: 56, inStock: true },
  { id: 'in1', name: 'Nag Champa Incense Bundle', slug: 'nag-champa-incense', price: 149, originalPrice: 299, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.6, reviewCount: 567, badge: 'new', inStock: true },
  { id: 'in2', name: 'Brass Diya Set of 5', slug: 'brass-diya-set', price: 349, originalPrice: 699, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.7, reviewCount: 678, badge: 'bestseller', inStock: true, soldCount: 534 },
  { id: 'in3', name: 'Govardhan Puja Thali Set', slug: 'puja-thali', price: 899, originalPrice: 1599, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.7, reviewCount: 145, inStock: true },
  { id: 'in4', name: 'Camphor Tablets — 100g', slug: 'camphor-tablets', price: 89, originalPrice: 179, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.5, reviewCount: 890, inStock: true },
  { id: 'in5', name: 'Pure Ghee Diya Cotton Wicks', slug: 'diya-wicks', price: 49, originalPrice: 99, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.4, reviewCount: 1234, inStock: true },
  { id: 'a1', name: 'Tulsi Kanti Mala — Premium', slug: 'tulsi-kanti-mala', price: 189, originalPrice: 399, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.7, reviewCount: 412, badge: 'new', inStock: true },
  { id: 'a2', name: 'Chandan Tilak Paste — 100g', slug: 'chandan-tilak', price: 129, originalPrice: 249, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.8, reviewCount: 1567, badge: 'bestseller', inStock: true, soldCount: 1203 },
  { id: 'a3', name: 'Rudraksha Bracelet — 5 Mukhi', slug: 'rudraksha-bracelet', price: 299, originalPrice: 599, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.6, reviewCount: 345, inStock: true },
  { id: 'a4', name: 'Jaap Mala — 108 Beads', slug: 'jaap-mala', price: 149, originalPrice: 299, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.7, reviewCount: 678, inStock: true },
  { id: 'a5', name: 'Vrindavan Tilak Stamp', slug: 'tilak-stamp', price: 79, originalPrice: 149, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.3, reviewCount: 234, badge: 'new', inStock: true },
  { id: 'cl1', name: 'Silk Dhoti — Temple Grade', slug: 'silk-dhoti', price: 599, originalPrice: 1199, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.5, reviewCount: 76, badge: 'new', inStock: true },
  { id: 'cl2', name: 'Cotton Kurta — Saffron', slug: 'cotton-kurta-saffron', price: 449, originalPrice: 899, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.6, reviewCount: 123, inStock: true },
  { id: 'cl3', name: 'Devotee Saree — White Cotton', slug: 'devotee-saree', price: 799, originalPrice: 1599, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.8, reviewCount: 67, inStock: true },
  { id: 'cl4', name: "Children's Radha Dress Set", slug: 'radha-dress-set', price: 649, originalPrice: 1299, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.9, reviewCount: 45, badge: 'new', inStock: true },
  { id: 'g1', name: 'Pure Vrindavan Cow Ghee 500ml', slug: 'cow-ghee', price: 449, originalPrice: 799, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.8, reviewCount: 328, inStock: true },
  { id: 'g2', name: 'Vrindavan Rose Gulkand 250g', slug: 'rose-gulkand', price: 199, originalPrice: 399, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.6, reviewCount: 345, badge: 'bestseller', inStock: true, soldCount: 289 },
  { id: 'g3', name: 'Organic Tulsi Honey 500g', slug: 'tulsi-honey', price: 349, originalPrice: 699, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.7, reviewCount: 198, inStock: true },
  { id: 'g4', name: 'A2 Cow Milk Powder — 200g', slug: 'cow-milk-powder', price: 299, originalPrice: 549, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.5, reviewCount: 87, badge: 'new', inStock: true },
  { id: 'g5', name: 'Satvik Spice Combo Box', slug: 'satvik-spice-combo', price: 399, originalPrice: 799, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.8, reviewCount: 234, inStock: true },
];

const defaultCategories: Category[] = [
  { id: 'c1', name: 'Prasadam', icon: '🍮', color: 'saffron', productCount: 6 },
  { id: 'c2', name: 'Spiritual Books', icon: '📚', color: 'maroon', productCount: 6 },
  { id: 'c3', name: 'Idols & Shringar', icon: '🪔', color: 'gold', productCount: 5 },
  { id: 'c4', name: 'Incense & Pooja', icon: '🕯️', color: 'divine-purple', productCount: 5 },
  { id: 'c5', name: 'Accessories', icon: '📿', color: 'tulsi', productCount: 5 },
  { id: 'c6', name: 'Clothing', icon: '👘', color: 'lotus', productCount: 4 },
  { id: 'c7', name: 'Groceries', icon: '🌿', color: 'tulsi', productCount: 5 },
  { id: 'c8', name: 'Braj Yatra', icon: '🛕', color: 'maroon', productCount: 0 },
];

interface ProductStore {
  products: Product[];
  categories: Category[];

  // Product CRUD
  addProduct: (product: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Category CRUD
  addCategory: (category: Category) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Queries
  getProductsByCategory: (category: string) => Product[];
  getProductBySlug: (slug: string) => Product | undefined;
  getProductById: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  getLatestProducts: () => Product[];
  getBestSellers: () => Product[];
}

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: defaultProducts,
      categories: defaultCategories,

      addProduct: (product) => set((s) => ({ products: [product, ...s.products] })),
      updateProduct: (id, data) => set((s) => ({
        products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addCategory: (category) => set((s) => ({ categories: [...s.categories, category] })),
      updateCategory: (id, data) => set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
      })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      getProductsByCategory: (category) => get().products.filter((p) => p.category.toLowerCase() === category.toLowerCase()),
      getProductBySlug: (slug) => get().products.find((p) => p.slug === slug),
      getProductById: (id) => get().products.find((p) => p.id === id),
      searchProducts: (query) => {
        const q = query.toLowerCase();
        return get().products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
      },
      getLatestProducts: () => get().products.filter((p) => p.badge === 'new'),
      getBestSellers: () => get().products.filter((p) => p.badge === 'bestseller'),
    }),
    { name: 'brajmart-products' }
  )
);

export const categorySlugMap: Record<string, string> = {
  'prasadam': 'Prasadam',
  'spiritual-books': 'Spiritual Books',
  'idols-shringar': 'Idols & Shringar',
  'incense-pooja': 'Incense & Pooja',
  'accessories': 'Accessories',
  'clothing': 'Clothing',
  'groceries': 'Groceries',
  'braj-yatra': 'Braj Yatra',
};

export const categoryToSlug = (name: string): string => {
  return name.toLowerCase().replace(/[&\s]+/g, '-').replace(/--+/g, '-');
};
