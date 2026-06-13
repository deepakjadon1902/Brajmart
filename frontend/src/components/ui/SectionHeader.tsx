import { ScrollReveal } from './ScrollReveal';
import { Link } from 'react-router-dom';

interface SectionHeaderProps {
  tag?: string;
  title: string;
  subtitle?: string;
  viewAllLink?: string;
  titleIconUrl?: string;
  viewAllIconUrl?: string;
  ornamentIconUrl?: string;
  light?: boolean;
}

const SectionHeader = ({
  tag,
  title,
  subtitle,
  viewAllLink,
  // Icons intentionally not rendered (simpler, more professional headings).
  // Keep props for backwards compatibility with existing callers.
  titleIconUrl: _titleIconUrl,
  viewAllIconUrl: _viewAllIconUrl,
  ornamentIconUrl: _ornamentIconUrl,
  light = false,
}: SectionHeaderProps) => (
  <ScrollReveal className="text-center mb-3 sm:mb-4 md:mb-5">
    {tag && (
        <span className="inline-block text-[0.65rem] font-semibold tracking-[0.16em] uppercase text-gold mb-1.5">
        {tag}
      </span>
    )}

    <h2 className={`font-cinzel text-lg sm:text-xl md:text-2xl lg:text-[1.7rem] font-bold leading-tight ${light ? 'text-primary-foreground' : 'text-maroon'}`}>
      {title}
    </h2>

    {subtitle && (
      <p className={`mt-1 font-playfair italic text-sm md:text-[0.95rem] ${light ? 'text-gold-light' : 'text-muted-foreground'}`}>
        {subtitle}
      </p>
    )}

    {viewAllLink && (
      <Link to={viewAllLink} className="inline-flex items-center mt-4 text-saffron font-semibold text-sm hover:underline">
        <span>View All</span>
      </Link>
    )}
  </ScrollReveal>
);

export default SectionHeader;
