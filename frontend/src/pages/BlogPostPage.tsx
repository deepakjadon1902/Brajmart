import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { fetchAdminBlogBySlug, fetchBlogBySlug } from '@/lib/api';
import type { BlogPost } from '@/types/blog';
import { useAdminStore } from '@/store/adminStore';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BlogPostPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdminAuthenticated = useAdminStore((s) => s.isAdminAuthenticated);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!slug) {
          setPost(null);
          return;
        }
        const data = isAdminAuthenticated
          ? await fetchAdminBlogBySlug(slug)
          : await fetchBlogBySlug(slug);
        if (!active) return;
        setPost(data || null);
      } catch {
        if (!active) return;
        if (isAdminAuthenticated) {
          try {
            const fallback = await fetchBlogBySlug(slug);
            if (!active) return;
            setPost(fallback || null);
            return;
          } catch {
            if (!active) return;
          }
        }
        setPost(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [slug, isAdminAuthenticated]);

  const paragraphs = useMemo(() => {
    if (!post?.content) return [];
    return post.content
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [post?.content]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-14 md:py-20">
        <div className="container mx-auto px-4">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-gold hover:underline mb-6">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-xs mb-3">
              {post?.category || 'BrajMart'}
            </p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">
              {post?.title || 'Blog Post'}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-primary-foreground/70">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(post?.publishedAt || post?.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {post?.readTime || 5} min read</span>
              <span className="text-gold">By {post?.author || 'BrajMart Team'}</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4">
          {loading && (
            <div className="text-center text-muted-foreground">Loading post...</div>
          )}

          {!loading && !post && (
            <div className="text-center text-muted-foreground">This blog post is not available.</div>
          )}

          {post && (
            <article className="max-w-4xl mx-auto">
              {post.coverImage && (
                <div className="aspect-[16/9] rounded-3xl overflow-hidden border border-border shadow-lg mb-10">
                  <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-6">
                {paragraphs.length ? (
                  paragraphs.map((para, idx) => (
                    <p key={idx} className="text-lg text-foreground/90 leading-relaxed font-playfair">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-lg text-muted-foreground font-playfair">
                    This post will be updated soon with more details.
                  </p>
                )}
              </div>
            </article>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BlogPostPage;
