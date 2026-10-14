import { ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { LIBRARY_SORTS, type LibrarySort } from '@/shared/settings';

/**
 * Picks the order of the books. Disabled while grouped by series, whose order is fixed (series
 * alphabetically, books by volume).
 */
export function SortPicker({
  sort,
  onChange,
  disabled,
}: {
  sort: LibrarySort;
  onChange: (sort: LibrarySort) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation('library');
  return (
    <label
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-md border px-2',
        disabled && 'cursor-not-allowed bg-muted text-muted-foreground',
      )}
      title={disabled ? t('sortDisabledGrouped') : t('sortLabel')}
    >
      <ArrowUpDown className="size-4 text-muted-foreground" />
      <span className="sr-only">{t('sortLabel')}</span>
      <select
        value={sort}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as LibrarySort)}
        className="bg-transparent text-sm outline-none disabled:cursor-not-allowed"
      >
        {disabled ? (
          // The grouped view has its own order: say so instead of showing a setting that doesn't apply.
          <option value={sort}>{t('sortGrouped')}</option>
        ) : (
          LIBRARY_SORTS.map((value) => (
            <option key={value} value={value} className="bg-background text-foreground">
              {t(`sorts.${value}`)}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
