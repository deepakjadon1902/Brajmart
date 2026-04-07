import { ScrollReveal } from './ScrollReveal';
import { Link } from 'react-router-dom';

interface SectionHeaderProps {
  tag?: string;
  title: string;
  subtitle?: string;
  viewAllLink?: string;
  light?: boolean;
}

const SectionHeader = ({ tag, title, subtitle, viewAllLink, light = false }: SectionHeaderProps) => (
  <ScrollReveal className="text-center mb-10 md:mb-14">
    {/* Lotus ornament */}
    <div className="flex items-center justify-center gap-3 mb-4">
      <span className="h-px w-12 bg-gold/40" />
      <span className="text-gold text-2xl">?</span>
      <span className="h-px w-12 bg-gold/40" />
    </div>

    {tag && (
      <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-3">
        {tag}
      </span>
    )}

    <h2 className={`font-cinzel text-2xl md:text-3xl lg:text-4xl font-bold leading-tight ${light ? 'text-primary-foreground' : 'text-maroon'}`}>
      {title}
    </h2>

    {subtitle && (
      <p className={`mt-2 font-playfair italic text-base md:text-lg ${light ? 'text-gold-light' : 'text-muted-foreground'}`}>
        {subtitle}
      </p>
    )}

    {viewAllLink && (
      <Link to={viewAllLink} className="inline-flex items-center mt-4 text-saffron font-semibold text-sm hover:underline">
        View All ?
      </Link>
    )}
  </ScrollReveal>
);

export default SectionHeader;
