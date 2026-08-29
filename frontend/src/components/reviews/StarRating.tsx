import { KeyboardEvent } from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
  label?: string;
};

const StarRating = ({ value, onChange, readonly = false, size = 18, label = 'Rating' }: StarRatingProps) => {
  const rounded = Math.round(Number(value || 0));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readonly || !onChange) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(5, Math.max(1, rounded + 1)));
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(Math.max(1, rounded - 1));
    }
  };

  if (readonly) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${Number(value || 0).toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={size} className={star <= rounded ? 'fill-[#d69a00] text-[#d69a00]' : 'text-muted-foreground/40'} aria-hidden="true" />
        ))}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron focus:ring-offset-2"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={rounded === star}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange?.(star)}
          className="rounded p-1 text-[#d69a00] transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-saffron"
        >
          <Star size={size} className={star <= rounded ? 'fill-current' : ''} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
