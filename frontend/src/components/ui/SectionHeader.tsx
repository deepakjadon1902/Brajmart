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

const DEFAULT_ORNAMENT_ICON_URL = 'https://unpkg.com/lucide-static@latest/icons/flower-2.svg';

const SectionHeader = ({
  tag,
  title,
  subtitle,
  viewAllLink,
  titleIconUrl,
  viewAllIconUrl,
  ornamentIconUrl = DEFAULT_ORNAMENT_ICON_URL,
  light = false,
}: SectionHeaderProps) => (
  <ScrollReveal className="text-center mb-10 md:mb-14">
    {/* Lotus ornament */}
    <div className="flex items-center justify-center gap-3 mb-4">
      <span className="h-px w-12 bg-gold/40" />
      <img
        src={ornamentIconUrl}
        alt=""
        aria-hidden="true"
        className="h-6 w-6 opacity-80"
      />
      <span className="h-px w-12 bg-gold/40" />
    </div>

    {tag && (
      <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-3">
        {tag}
      </span>
    )}

    <h2 className={`font-cinzel text-2xl md:text-3xl lg:text-4xl font-bold leading-tight ${light ? 'text-primary-foreground' : 'text-maroon'}`}>
      <span className="inline-flex items-center justify-center gap-2">
        {titleIconUrl && (
          <img
            src={titleIconUrl}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 md:h-7 md:w-7"
          />
        )}
        {title}
      </span>
    </h2>

    {subtitle && (
      <p className={`mt-2 font-playfair italic text-base md:text-lg ${light ? 'text-gold-light' : 'text-muted-foreground'}`}>
        {subtitle}
      </p>
    )}

    {viewAllLink && (
      <Link to={viewAllLink} className="inline-flex items-center mt-4 text-saffron font-semibold text-sm hover:underline">
        <span>View All</span>
        {viewAllIconUrl && (
          <img
            src={viewAllIconUrl}
            alt=""
            aria-hidden="true"
            className="ml-2 h-4 w-4"
          />
        )}
      </Link>
    )}
  </ScrollReveal>
);

export default SectionHeader;
