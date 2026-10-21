import { ListPlus, Pencil, ScanSearch, Trash2 } from 'lucide-react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCover } from '@/components/book-cover';
import { bookTooltip } from '@/lib/book-tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LibraryEntry } from '@/shared/library';

/** The actions of a book card, the same as a row's. */
export interface BookCardActions {
  onOpen: () => void;
  onEdit: () => void;
  onLookup: () => void;
  onAddToList: () => void;
  onRemove: () => void;
}

/**
 * A book of the library's grid view: its cover, with the series, title and volume under it. The
 * whole card is the drag handle towards a reading list (`onDragStart`), the tick box takes part in the
 * selection like a row's, and the actions appear over the cover when the card is hovered or focused.
 */
export function BookCard({
  entry,
  selected,
  selectionCount,
  onTick,
  onDragStart,
  actions,
  editions = [],
}: {
  entry: LibraryEntry;
  selected: boolean;
  /** Books selected in all; more than one changes the drag hint of a selected book. */
  selectionCount: number;
  onTick: (shift: boolean) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  actions: BookCardActions;
  /** The book's files when it exists in several formats: one button each, to pick the one to open. */
  editions?: { id: string; format: string; onOpen: () => void }[];
}) {
  const { t } = useTranslation(['library', 'common']);
  const iconButton = 'bg-background/85 hover:bg-background';
  return (
    <article
      draggable
      onDragStart={onDragStart}
      title={t(selected && selectionCount > 1 ? 'dragSelectionHint' : 'dragHint')}
      className="group relative flex min-w-0 cursor-grab flex-col gap-1.5 active:cursor-grabbing"
    >
      <div className="relative">
        <button
          type="button"
          onClick={actions.onOpen}
          title={t('common:open')}
          aria-label={t('openNamed', { title: entry.title })}
          className="block w-full rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BookCover entryId={entry.id} title={entry.title} className="aspect-[2/3] w-full" />
        </button>
        <input
          type="checkbox"
          checked={selected}
          // React derives a checkbox's change from its click, so the native event carries Shift.
          onChange={(event) => onTick((event.nativeEvent as MouseEvent).shiftKey)}
          title={t('selectHint')}
          aria-label={t('selectNamed', { title: entry.title })}
          className={cn(
            'absolute top-1.5 left-1.5 size-4 cursor-pointer',
            !selected && 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
          )}
        />
        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" className={iconButton} onClick={actions.onEdit} title={t('editHint')} aria-label={t('edit')}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" className={iconButton} onClick={actions.onLookup} title={t('lookupHint')} aria-label={t('lookup')}>
            <ScanSearch />
          </Button>
          <Button variant="ghost" size="icon-sm" className={iconButton} onClick={actions.onAddToList} title={t('addToList')} aria-label={t('addToList')}>
            <ListPlus />
          </Button>
          <Button variant="ghost" size="icon-sm" className={iconButton} onClick={actions.onRemove} title={t('remove')} aria-label={t('remove')}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="min-w-0 text-sm" title={bookTooltip(entry)}>
        {entry.series && <p className="truncate text-xs text-muted-foreground">{entry.series}</p>}
        <p className="truncate font-medium">{entry.title}</p>
        {entry.volume && <p className="truncate text-xs text-muted-foreground">{t('volumeShort', { volume: entry.volume })}</p>}
        {editions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {editions.map((edition) => (
              <Button
                key={edition.id}
                variant="secondary"
                size="xs"
                onClick={edition.onOpen}
                title={t('openFormat', { format: edition.format })}
                aria-label={t('openFormatNamed', { title: entry.title, format: edition.format })}
              >
                {edition.format}
              </Button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
