import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { SeriesHeaderRow } from '@/lib/library-groups';

/** A series heading of the grouped view: folds or unfolds its books on click. */
export function SeriesHeader({
  row,
  ref,
  index,
  start,
  onToggle,
}: {
  row: SeriesHeaderRow;
  ref: (element: HTMLLIElement | null) => void;
  index: number;
  start: number;
  onToggle: () => void;
}) {
  const { t } = useTranslation('library');
  const name = row.series ?? t('noSeries');
  const Chevron = row.collapsed ? ChevronRight : ChevronDown;
  return (
    <li
      ref={ref}
      data-index={index}
      style={{ transform: `translateY(${start}px)` }}
      className="absolute top-0 left-0 w-full border-b bg-muted/50"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!row.collapsed}
        aria-label={t(row.collapsed ? 'expandSeries' : 'collapseSeries', { series: name })}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
      >
        <Chevron className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn('min-w-0 truncate font-semibold', row.series === null && 'text-muted-foreground italic')}>
          {name}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {t('seriesProgress', { finished: row.finished, count: row.count })}
        </span>
      </button>
    </li>
  );
}
