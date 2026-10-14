import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { RatingFilter } from '@/lib/library-filter';
import { cn } from '@/lib/utils';

/** Picks a *minimum* rating: clicking the 3rd star keeps everything rated 3 and above. */
export function RatingFilterPicker({
  rating,
  onChange,
}: {
  rating: RatingFilter;
  onChange: (rating: RatingFilter) => void;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="flex h-9 items-center gap-1 rounded-md border px-2">
      <span className="text-xs text-muted-foreground">{t('ratingFilter')}</span>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          // Clicking the star that already sets the current minimum clears the filter.
          onClick={() => onChange(value === rating ? 'all' : value)}
          aria-pressed={rating !== 'all' && value <= rating}
          title={t('atLeast', { count: value })}
          aria-label={t('atLeast', { count: value })}
          className="text-muted-foreground hover:text-yellow-500"
        >
          <Star className={cn('size-4', rating !== 'all' && value <= rating && 'fill-yellow-400 text-yellow-500')} />
        </button>
      ))}
    </div>
  );
}
