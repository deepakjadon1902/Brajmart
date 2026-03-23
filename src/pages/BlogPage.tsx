import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const posts = [
  { id: 1, title: 'The Sacred Significance of Tulsi Mala in Bhakti', excerpt: 'Discover why Tulsi mala holds a special place in Vaishnava tradition and how wearing it deepens your connection to Lord Krishna.', date: 'Mar 15, 2025', readTime: '5 min', category: 'Spirituality', image: 'https://images.unsplash.com/photo-1609947017136-9daa5e06a2e5?w=600&h=400&fit=crop' },
  { id: 2, title: 'How to Prepare Satvik Bhoga at Home', excerpt: 'A complete guide to preparing pure, satvik food offerings for your home deity — with recipes from Vrindavan\'s temple kitchens.', date: 'Mar 10, 2025', readTime: '8 min', category: 'Recipes', image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&h=400&fit=crop' },
  { id: 3, title: 'Exploring the 84 Kos Braj Yatra Circuit', excerpt: 'An in-depth guide to the sacred 84 Kos Braj Yatra — covering all major temples, routes, and spiritual significance of each stop.', date: 'Mar 5, 2025', readTime: '12 min', category: 'Braj Yatra', image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=400&fit=crop' },
  { id: 4, title: 'The Art of Deity Shringar — Dressing the Divine', excerpt: 'Learn the traditional art of dressing and decorating your home deities with love, devotion, and the finest Shringar items.', date: 'Feb 28, 2025', readTime: '6 min', category: 'Traditions', image: 'https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=600&h=400&fit=crop' },
  { id: 5, title: 'Benefits of Reading Srila Prabhupada\'s Books Daily', excerpt: 'How dedicating just 30 minutes daily to Prabhupada\'s timeless wisdom can transform your spiritual journey and daily life.', date: 'Feb 20, 2025', readTime: '7 min', category: 'Books', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop' },
  { id: 6, title: 'Janmashtami Celebrations Across Braj Bhumi', excerpt: 'A photographic journey through the most spectacular Janmashtami celebrations in Vrindavan, Mathura, and surrounding Braj temples.', date: 'Feb 15, 2025', readTime: '10 min', category: 'Festivals', image: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=600&h=400&fit=crop' },
];

const BlogPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">DIVINE WISDOM</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">BrajMart Blog</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Stories, guides, and spiritual wisdom from the heart of Vrindavan.</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <ScrollReveal key={post.id} delay={i * 0.08}>
              <article className="bg-card rounded-2xl border border-border overflow-hidden group hover:border-gold/40 hover:shadow-xl transition-all duration-300">
                <div className="aspect-[3/2] overflow-hidden">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-saffron/10 text-saffron text-xs font-semibold mb-3">{post.category}</span>
                  <h3 className="font-playfair text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-saffron transition-colors">{post.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                    </div>
                    <span className="text-saffron font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">Read <ArrowRight size={12} /></span>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default BlogPage;
