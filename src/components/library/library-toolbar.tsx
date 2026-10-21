import { FileQuestion, Layers, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ViewModePicker } from '@/components/book-row';
import { RatingFilterPicker } from '@/components/library/rating-filter-picker';
import { SortPicker } from '@/components/library/sort-picker';
import { Button } from '@/components/ui/button';
import { EMPTY_FILTERS, hasActiveFilters, type LibraryFilters } from '@/lib/library-filter';
import { tagLabel } from '@/lib/reading-list';
import { cn } from '@/lib/utils';
import type { LibrarySort, LibraryView } from '@/shared/settings';

/** Search field, filters, order and display options above the library list. */
export function LibraryToolbar({
  filters,
  onChange,
  tags,
  shown,
  total,
  view,
  onViewChange,
  grouped,
  onGroupedChange,
  sort,
  onSortChange,
}: {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  tags: string[];
  shown: number;
  total: number;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  grouped: boolean;
  onGroupedChange: (grouped: boolean) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
}) {
  const { t } = useTranslation('library');
  const active = hasActiveFilters(filters);

  const toggleTag = (tag: string) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag],
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            type="search"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <RatingFilterPicker
          rating={filters.rating}
          onChange={(rating) => onChange({ ...filters, rating })}
        />

        <Button
          variant={filters.withoutFiche ? 'secondary' : 'outline'}
          size="icon"
          onClick={() => onChange({ ...filters, withoutFiche: !filters.withoutFiche })}
          aria-pressed={filters.withoutFiche}
          title={t('withoutFiche')}
          aria-label={t('withoutFiche')}
        >
          <FileQuestion />
        </Button>

        <SortPicker sort={sort} onChange={onSortChange} disabled={grouped} />

        <ViewModePicker view={view} onChange={onViewChange} withGrid />

        <Button
          variant={grouped ? 'secondary' : 'outline'}
          size="icon"
          onClick={() => onGroupedChange(!grouped)}
          aria-pressed={grouped}
          title={t('groupBySeries')}
          aria-label={t('groupBySeries')}
        >
          <Layers />
        </Button>

        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            <X />
            {t('reset')}
          </Button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            const selected = filters.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={selected}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {tagLabel(tag)}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <p className="text-xs text-muted-foreground">{t('shownOf', { shown, total })}</p>
      )}
    </div>
  );
}
