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
  <ScrollReveal className="text-center mb-8 sm:mb-10 md:mb-14">
    {tag && (
      <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-3">
        {tag}
      </span>
    )}

    <h2 className={`font-cinzel text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight ${light ? 'text-primary-foreground' : 'text-maroon'}`}>
      {title}
    </h2>

    {subtitle && (
      <p className={`mt-2 font-playfair italic text-sm sm:text-base md:text-lg ${light ? 'text-gold-light' : 'text-muted-foreground'}`}>
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
