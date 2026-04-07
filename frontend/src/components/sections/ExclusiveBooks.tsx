import { ScrollReveal } from '../ui/ScrollReveal';

const ExclusiveBooks = () => (
  <section className="py-14 md:py-20 bg-maroon relative overflow-hidden">
    <div className="container mx-auto px-4">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <ScrollReveal direction="left">
          <span className="inline-block px-3 py-1 rounded-full bg-gold-gradient text-maroon-dark text-xs font-bold mb-4">
            BRAJMART EXCLUSIVE
          </span>
          <h2 className="font-cinzel text-2xl md:text-4xl font-bold text-primary-foreground leading-tight mb-3">
            Brajmart Exclusive Books
          </h2>
          <h3 className="font-playfair italic text-gold-light text-lg mb-4">
            Read, Reflect & Realize the Divine
          </h3>
          <p className="text-primary-foreground/70 text-sm leading-relaxed mb-6 max-w-md">
            Explore the complete collection of Srila Prabhupada's timeless wisdom — Bhagavad Gita As It Is,
            Srimad Bhagavatam, and other sacred scriptures that illuminate the path of devotion.
          </p>
          <button className="px-6 py-2.5 rounded-full border-2 border-gold text-gold font-semibold text-sm hover:bg-gold hover:text-maroon-dark transition-colors active:scale-[0.97]">
            Browse All Books →
          </button>
        </ScrollReveal>

        <ScrollReveal direction="right">
          <div className="grid grid-cols-2 gap-4">
            {['Bhagavad Gita As It Is', 'Srimad Bhagavatam', 'Chaitanya Charitamrita', 'Science of Self-Realization'].map((title, i) => (
              <div key={i} className="rounded-xl border border-gold/30 bg-primary-foreground/5 p-4 text-center group hover:border-gold transition-colors">
                <div className="aspect-[3/4] bg-primary-foreground/10 rounded-lg mb-3 flex items-center justify-center text-3xl">
                  📖
                </div>
                <h4 className="text-primary-foreground text-xs font-semibold line-clamp-2">{title}</h4>
                <span className="text-gold text-xs mt-1 block">From ₹249</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default ExclusiveBooks;
