import { Product } from '@/types/product';

const img = (seed: string) => `https://images.unsplash.com/photo-${seed}?w=400&h=400&fit=crop&auto=format`;

export const latestProducts: Product[] = [
  { id: '1', name: 'Vrindavan Temple Prasadam Box', slug: 'vrindavan-prasadam-box', price: 319, originalPrice: 699, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.8, reviewCount: 234, badge: 'new', inStock: true },
  { id: '2', name: 'Bhagavad Gita As It Is', slug: 'bhagavad-gita', price: 249, originalPrice: 499, image: img('1544947950-fa07a98d237f'), category: 'Books', rating: 4.9, reviewCount: 1823, badge: 'bestseller', inStock: true },
  { id: '3', name: 'Tulsi Kanti Mala — Premium', slug: 'tulsi-kanti-mala', price: 189, originalPrice: 399, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.7, reviewCount: 412, badge: 'new', inStock: true },
  { id: '4', name: 'Radha Krishna Brass Idol', slug: 'radha-krishna-idol', price: 1849, originalPrice: 3499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.9, reviewCount: 89, inStock: true },
  { id: '5', name: 'Nag Champa Incense Bundle', slug: 'nag-champa-incense', price: 149, originalPrice: 299, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.6, reviewCount: 567, badge: 'new', inStock: true },
  { id: '6', name: 'Pure Vrindavan Cow Ghee 500ml', slug: 'cow-ghee', price: 449, originalPrice: 799, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.8, reviewCount: 328, inStock: true },
  { id: '7', name: 'Silk Dhoti — Temple Grade', slug: 'silk-dhoti', price: 599, originalPrice: 1199, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.5, reviewCount: 76, badge: 'new', inStock: true },
  { id: '8', name: 'Govardhan Puja Thali Set', slug: 'puja-thali', price: 899, originalPrice: 1599, image: img('1609710228159-0fa9bd7c0827'), category: 'Incense & Pooja', rating: 4.7, reviewCount: 145, inStock: true },
];

export const bestSellingProducts: Product[] = [
  { id: 'b1', name: 'ISKCON Mathura Peda Box', slug: 'iskcon-peda', price: 279, originalPrice: 549, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.9, reviewCount: 2341, badge: 'bestseller', inStock: true, soldCount: 847 },
  { id: 'b2', name: 'Srimad Bhagavatam Set', slug: 'srimad-bhagavatam', price: 2499, originalPrice: 4999, image: img('1544947950-fa07a98d237f'), category: 'Books', rating: 5.0, reviewCount: 892, badge: 'bestseller', inStock: true, soldCount: 423 },
  { id: 'b3', name: 'Chandan Tilak Paste — 100g', slug: 'chandan-tilak', price: 129, originalPrice: 249, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.8, reviewCount: 1567, badge: 'bestseller', inStock: true, soldCount: 1203 },
  { id: 'b4', name: 'Brass Diya Set of 5', slug: 'brass-diya-set', price: 349, originalPrice: 699, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.7, reviewCount: 678, badge: 'bestseller', inStock: true, soldCount: 534 },
  { id: 'b5', name: 'Vrindavan Rose Gulkand 250g', slug: 'rose-gulkand', price: 199, originalPrice: 399, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.6, reviewCount: 345, badge: 'bestseller', inStock: true, soldCount: 289 },
  { id: 'b6', name: 'Laddu Gopal Shringar Set', slug: 'laddu-gopal-shringar', price: 749, originalPrice: 1499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.9, reviewCount: 234, badge: 'bestseller', inStock: true, soldCount: 167 },
];

export const newArrivals: Product[] = latestProducts.slice(0, 6).map(p => ({ ...p, id: `n${p.id}`, badge: 'new' as const }));

export const categories = [
  { id: 'c1', name: 'Prasadam', icon: '🍮', color: 'saffron', productCount: 48 },
  { id: 'c2', name: 'Spiritual Books', icon: '📚', color: 'maroon', productCount: 124 },
  { id: 'c3', name: 'Idols & Shringar', icon: '🪔', color: 'gold', productCount: 87 },
  { id: 'c4', name: 'Incense & Pooja', icon: '🕯️', color: 'divine-purple', productCount: 63 },
  { id: 'c5', name: 'Accessories', icon: '📿', color: 'tulsi', productCount: 95 },
  { id: 'c6', name: 'Clothing', icon: '👘', color: 'lotus', productCount: 56 },
  { id: 'c7', name: 'Groceries', icon: '🌿', color: 'tulsi', productCount: 72 },
  { id: 'c8', name: 'Braj Yatra', icon: '🛕', color: 'maroon', productCount: 18 },
];

export const heroSlides = [
  {
    id: 1,
    tag: '🎉 Festival Special',
    title: 'Celebrate the Divine Birth of Lord Krishna',
    subtitle: 'Authentic Janmashtami essentials — Shringar, Prasadam & More',
    cta: 'Shop Janmashtami Collection',
    image: 'https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=1600&h=900&fit=crop',
    overlay: 'from-indigo-950/80 via-indigo-900/50 to-transparent',
  },
  {
    id: 2,
    tag: '🌸 Vrindavan Collection',
    title: 'Authentic Products from the Land of Braj',
    subtitle: 'Directly sourced from Vrindavan\'s sacred temples and artisans',
    cta: 'Explore Vrindavan Special',
    image: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?w=1600&h=900&fit=crop',
    overlay: 'from-amber-950/70 via-orange-900/40 to-transparent',
  },
  {
    id: 3,
    tag: '🍮 Temple Prasadam',
    title: 'Taste the Blessings of Sacred Temples',
    subtitle: 'ISKCON, Sapt Devalaya & Braj Temple Prasadam — Delivered Fresh',
    cta: 'Order Prasadam Now',
    image: 'https://images.unsplash.com/photo-1606567595334-d39972c85dbe?w=1600&h=900&fit=crop',
    overlay: 'from-red-950/80 via-red-900/50 to-transparent',
  },
  {
    id: 4,
    tag: '📚 Righteous Path',
    title: 'Read, Reflect & Realize the Divine Truth',
    subtitle: 'Complete collection of Srila Prabhupada\'s timeless wisdom',
    cta: 'Shop Spiritual Books',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1600&h=900&fit=crop',
    overlay: 'from-emerald-950/80 via-emerald-900/50 to-transparent',
  },
];

export const testimonials = [
  { id: 't1', name: 'Priya Sharma', city: 'Delhi', rating: 5, text: 'The prasadam from BrajMart tastes exactly like what I had at Vrindavan temple. Absolutely authentic and divine!' },
  { id: 't2', name: 'Rajesh Gupta', city: 'Mumbai', rating: 5, text: 'Ordered the Bhagavad Gita and Tulsi Mala. Packaging was premium and delivery was quick. Hare Krishna! 🙏' },
  { id: 't3', name: 'Ananya Devi', city: 'Bengaluru', rating: 5, text: 'Best place to buy authentic Vrindavan products online. The deity shringar set is stunning quality.' },
  { id: 't4', name: 'Suresh Patel', city: 'Ahmedabad', rating: 4, text: 'Love the combo offers! Got temple prasadam + incense bundle at an amazing price. Will order again.' },
  { id: 't5', name: 'Meera Krishnan', city: 'Chennai', rating: 5, text: 'The pure cow ghee from Vrindavan is incredible. You can taste the authenticity. Thank you BrajMart!' },
];
