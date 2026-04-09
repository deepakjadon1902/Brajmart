import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchAdminBlogs, fetchBlogs } from '@/lib/api';
import type { BlogPost } from '@/types/blog';
import { useAdminStore } from '@/store/adminStore';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BlogPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('published');
  const isAdminAuthenticated = useAdminStore((s) => s.isAdminAuthenticated);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = isAdminAuthenticated ? await fetchAdminBlogs() : await fetchBlogs();
        if (!active) return;
        setPosts(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        if (isAdminAuthenticated) {
          try {
            const fallback = await fetchBlogs();
            if (!active) return;
            setPosts(Array.isArray(fallback) ? fallback : []);
            return;
          } catch {
            if (!active) return;
          }
        }
        setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      setFilter('all');
    } else {
      setFilter('published');
    }
  }, [isAdminAuthenticated]);

  const visiblePosts = isAdminAuthenticated
    ? posts.filter((p) => (filter === 'all' ? true : p.status === filter))
    : posts;

  const featured = visiblePosts[0];
  const rest = visiblePosts.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">DIVINE WISDOM</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">BrajMart Blog</h1>
            <p className="text-primary-foreground/70 max-w-xl mx-auto font-playfair">
              Stories, guides, and spiritual wisdom from the heart of Vrindavan.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 space-y-12">
          {loading && (
            <div className="text-center text-muted-foreground">Loading stories...</div>
          )}

          {!loading && !visiblePosts.length && (
            <div className="text-center text-muted-foreground">No blog posts yet. Check back soon.</div>
          )}

          {isAdminAuthenticated && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {([
                { key: 'all', label: 'All' },
                { key: 'published', label: 'Published' },
                { key: 'draft', label: 'Unpublished' },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wide transition ${
                    filter === item.key
                      ? 'bg-saffron/10 border-saffron text-saffron'
                      : 'border-border text-muted-foreground hover:text-saffron hover:border-saffron/60'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <span className="text-xs text-muted-foreground">Admin view: drafts visible</span>
            </div>
          )}

          {featured && (
            <ScrollReveal>
              <article className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-stretch bg-card border border-border rounded-3xl overflow-hidden hover:shadow-xl transition-all">
                <div className="h-full min-h-[240px]">
                  {featured.coverImage ? (
                    <img src={featured.coverImage} alt={featured.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-pearl" />
                  )}
                </div>
                <div className="p-8 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex w-fit px-3 py-1 rounded-full bg-saffron/10 text-saffron text-xs font-semibold">
                      {featured.category || 'BrajMart'}
                    </span>
                    {isAdminAuthenticated && featured.status === 'draft' && (
                      <span className="inline-flex w-fit px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">
                        Draft
                      </span>
                    )}
                  </div>
                  <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground mb-3">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground text-base leading-relaxed font-playfair mb-5">
                    {featured.excerpt}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-5">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(featured.publishedAt || featured.createdAt)}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {featured.readTime || 5} min read</span>
                    <span className="text-saffron">By {featured.author || 'BrajMart Team'}</span>
                  </div>
                  <Link to={`/blog/${featured.slug}`} className="inline-flex items-center gap-2 text-saffron font-semibold text-sm hover:underline">
                    Read full story <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            </ScrollReveal>
          )}

          {!!rest.length && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map((post, i) => (
                <ScrollReveal key={post.id} delay={i * 0.08}>
                  <article className="bg-card rounded-2xl border border-border overflow-hidden group hover:border-gold/40 hover:shadow-xl transition-all duration-300">
                    <div className="aspect-[3/2] overflow-hidden">
                      {post.coverImage ? (
                        <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-pearl" />
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-block px-3 py-1 rounded-full bg-saffron/10 text-saffron text-xs font-semibold">
                          {post.category || 'BrajMart'}
                        </span>
                        {isAdminAuthenticated && post.status === 'draft' && (
                          <span className="inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="font-playfair text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-saffron transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(post.publishedAt || post.createdAt)}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime || 5} min</span>
                        </div>
                        <Link to={`/blog/${post.slug}`} className="text-saffron font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                          Read <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPage;
