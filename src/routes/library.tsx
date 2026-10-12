import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowUpDown, ChevronDown, ChevronRight, FolderOpen, FolderTree, GripVertical, Layers, ListPlus, Pencil, ScanSearch, Search, Star, Trash2, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddToListDialog } from '@/components/add-to-list-dialog';
import { BookDetails, BookRating, BookTags, ViewModePicker } from '@/components/book-row';
import { BookEditDialog } from '@/components/book-edit-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import { MetadataDialog } from '@/components/metadata-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLibrary } from '@/hooks/use-library';
import { useOrganizationOffer } from '@/hooks/use-organization-offer';
import { useSettings } from '@/hooks/use-settings';
import { appData } from '@/lib/app-data';
import {
  availableTags,
  EMPTY_FILTERS,
  filterEntries,
  hasActiveFilters,
  type LibraryFilters,
  type RatingFilter,
} from '@/lib/library-filter';
import { groupBySeries, ungroupedRows, type SeriesHeaderRow } from '@/lib/library-groups';
import { sortEntries } from '@/lib/library-sort';
import { draggedEntries, selectedEntries, toggleSelection } from '@/lib/library-selection';
import { encodeDraggedEntries, LIBRARY_ENTRY_DRAG_TYPE, QUICK_TAGS, tagLabel } from '@/lib/reading-list';
import { cn } from '@/lib/utils';
import type { LibraryEntry, ScanProgress } from '@/shared/library';
import { LIBRARY_SORTS, type BookRowView, type LibrarySort } from '@/shared/settings';

export const Route = createFileRoute('/library')({
  component: LibraryPage,
});

const NO_ENTRIES: LibraryEntry[] = [];

/** Height guessed for a row before it is measured, per display mode. */
const ESTIMATED_ROW_HEIGHT: Record<BookRowView, number> = { full: 128, medium: 104, compact: 49 };

/** Height guessed for a series heading of the grouped view. */
const ESTIMATED_HEADER_HEIGHT = 41;

function LibraryPage() {
  const { t } = useTranslation(['library', 'common']);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const offerOrganization = useOrganizationOffer(confirm);
  const navigate = useNavigate();
  const library = useLibrary();
  const { settings, update } = useSettings();
  const view = settings.libraryView;
  const grouped = settings.libraryGroupBySeries;
  const sort = settings.librarySort;
  const entries = library ?? NO_ENTRIES;
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [lookupEntry, setLookupEntry] = useState<LibraryEntry | null>(null);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [listEntries, setListEntries] = useState<LibraryEntry[] | null>(null);
  // Ids of the books ticked for a group action; kept across filter changes, so a selection can be
  // built from several searches. `anchor` is the book ticked last, the start of a Shift-click range.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  // The input follows the keystrokes; filtering and re-laying out the list can lag behind them.
  const deferredFilters = useDeferredValue(filters);
  const visible = useMemo(() => filterEntries(entries, deferredFilters), [entries, deferredFilters]);
  const tags = useMemo(() => availableTags(entries, QUICK_TAGS), [entries]);
  // Folded series last for the page's life only; a new key (a series renamed) starts unfolded.
  const [collapsedSeries, setCollapsedSeries] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(
    () => (grouped ? groupBySeries(visible, collapsedSeries) : ungroupedRows(sortEntries(visible, sort))),
    [grouped, visible, collapsedSeries, sort],
  );
  const toggleSeries = (key: string) =>
    setCollapsedSeries((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  // The books in the order they are drawn (grouped by series or not, folded series left out): the
  // order of a Shift-click range, of "select all" and of the books sent to a reading list.
  const shown = useMemo(() => rows.flatMap((row) => (row.kind === 'entry' ? [row.entry] : [])), [rows]);
  const selection = useMemo(() => selectedEntries(selected, shown, entries), [selected, shown, entries]);
  const shownSelected = shown.filter((entry) => selected.has(entry.id)).length;

  const tick = (id: string, shift: boolean) => {
    setSelected(toggleSelection(selected, shown.map((entry) => entry.id), id, anchor, shift));
    setAnchor(id);
  };

  const tickAllShown = () => {
    const next = new Set(selected);
    const select = shownSelected < shown.length;
    for (const entry of shown) {
      if (select) next.add(entry.id);
      else next.delete(entry.id);
    }
    setSelected(next);
  };

  // Subscribed for the whole page's life rather than around each scan: the main process starts
  // sending progress as soon as the directory is picked, which is before `addFolder()` resolves.
  useEffect(() => window.tankobon.library.onScanProgress(setScan), []);

  // The bar stays on its final state once the scan is done, until the user closes it.
  const scanning = scan !== null && scan.phase !== 'done';

  const addFolder = async () => {
    setScanStatus(null);
    const result = await window.tankobon.library.addFolder();
    if (result.status === 'cancelled') {
      setScan(null);
      return;
    }
    const parts = [t('scanAdded', { count: result.added, directory: result.directory })];
    if (result.skipped > 0) parts.push(t('scanSkipped', { count: result.skipped }));
    if (result.failed > 0) parts.push(t('scanFailed', { count: result.failed }));
    if (result.total === 0) {
      setScanStatus(t('scanNoneFound', { directory: result.directory }));
      return;
    }
    setScanStatus(parts.join(' · '));
    parts.push(...(await offerOrganization(result.organization)));
    setScanStatus(parts.join(' · '));
  };

  const addFile = async () => {
    setScanStatus(null);
    const result = await window.tankobon.library.addFile();
    if (result.status === 'added') {
      const parts = [t('fileAdded', { title: result.title })];
      setScanStatus(parts[0]);
      parts.push(...(await offerOrganization(result.organization)));
      setScanStatus(parts.join(' · '));
    } else if (result.status === 'exists') setScanStatus(t('fileExists', { title: result.title }));
    else if (result.status === 'error') setScanStatus(result.message);
  };

  // The list drops the entry on the main process's `data:changed`.
  const remove = async (entry: LibraryEntry) => {
    const confirmed = await confirm({
      title: t('confirmRemoveTitle'),
      message: t('confirmRemove', { title: entry.title }),
      action: t('confirmRemoveAction'),
    });
    if (!confirmed) return;
    await window.tankobon.library.remove(entry.id);
  };

  const replaceEntry = (updated: LibraryEntry) => appData.upsertEntry(updated);

  // Only the rows near the viewport exist: a library of tens of thousands of books stays light.
  const scrollRef = useRef<HTMLDivElement>(null);
  // A new search or order starts from the top, not from wherever the previous results were scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [deferredFilters, grouped, sort]);
  // The virtualizer's functions aren't memoized, which the React Compiler lint can't know is fine here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index].kind === 'series' ? ESTIMATED_HEADER_HEIGHT : ESTIMATED_ROW_HEIGHT[view]),
    getItemKey: (index) => {
      const row = rows[index];
      // A series heading's key can't collide with an entry id (a UUID).
      return row.kind === 'series' ? `series:${row.key}` : row.entry.id;
    },
    overscan: 6,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('intro')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addFile} disabled={scanning}>
          <FolderOpen />
          {t('addFile')}
        </Button>
        <Button variant="outline" onClick={addFolder} disabled={scanning}>
          <FolderTree />
          {t('addFolder')}
        </Button>
      </div>

      {scan && <ScanProgressBar progress={scan} onClose={() => setScan(null)} />}
      {scanStatus && <p className="text-sm text-muted-foreground">{scanStatus}</p>}

      {entries.length > 0 && (
        <LibraryToolbar
          filters={filters}
          onChange={setFilters}
          tags={tags}
          shown={visible.length}
          total={entries.length}
          view={view}
          onViewChange={(next) => update('libraryView', next)}
          grouped={grouped}
          onGroupedChange={(next) => update('libraryGroupBySeries', next)}
          sort={sort}
          onSortChange={(next) => update('librarySort', next)}
        />
      )}

      {shown.length > 0 && (
        <SelectionBar
          selectedCount={selection.length}
          shownSelected={shownSelected}
          shown={shown.length}
          onToggleAll={tickAllShown}
          onClear={() => setSelected(new Set())}
          onAddToList={() => setListEntries(selection)}
        />
      )}

      {library === null ? null : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noMatch')}</p>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-md border">
          <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (row.kind === 'series') {
                return (
                  <SeriesHeader
                    key={`series:${row.key}`}
                    row={row}
                    ref={virtualizer.measureElement}
                    index={item.index}
                    start={item.start}
                    onToggle={() => toggleSeries(row.key)}
                  />
                );
              }
              const entry = row.entry;
              return (
            <li
              key={entry.id}
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{ transform: `translateY(${item.start}px)` }}
              className={cn('absolute top-0 left-0 flex w-full flex-col gap-2 border-b px-3', view === 'compact' ? 'py-2' : 'py-3')}
            >
              <div className="flex items-center gap-3">
                {/* Only the grip drags the book onto a reading list of the sidebar; the rest of the
                    row opens it. A selected book carries the whole selection with it. The whole row
                    is the drag image (or a "N books" label for several), so the user sees what is carried. */}
                <div
                  draggable
                  onDragStart={(event) => {
                    const carried = draggedEntries(entry, selection);
                    event.dataTransfer.setData(LIBRARY_ENTRY_DRAG_TYPE, encodeDraggedEntries(carried));
                    // 'move', like the app's other drags, so the OS shows the same pointer (not the
                    // copy one with a "+"), even though the book stays in the library.
                    event.dataTransfer.effectAllowed = 'move';
                    if (carried.length > 1) setCountDragImage(event.dataTransfer, t('dragCount', { count: carried.length }));
                    else {
                      const row = event.currentTarget.closest('li');
                      if (row) event.dataTransfer.setDragImage(row, 0, 0);
                    }
                  }}
                  className="-ml-1 shrink-0 cursor-grab rounded-sm py-2 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
                  title={t(selected.has(entry.id) && selection.length > 1 ? 'dragSelectionHint' : 'dragHint')}
                  aria-label={t('dragHandle', { title: entry.title })}
                >
                  <GripVertical className="size-4" />
                </div>
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  // React derives a checkbox's change from its click, so the native event carries Shift.
                  onChange={(event) => tick(entry.id, (event.nativeEvent as MouseEvent).shiftKey)}
                  title={t('selectHint')}
                  aria-label={t('selectNamed', { title: entry.title })}
                  className="size-4 shrink-0 cursor-pointer"
                />
                <BookDetails
                  entry={entry}
                  view={view}
                  onOpen={() => void navigate({ to: '/reader', search: { book: entry.id } })}
                />
                {view !== 'compact' && <BookRating entry={entry} />}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditEntry(entry)}
                  title={t('editHint')}
                  aria-label={t('edit')}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setLookupEntry(entry)}
                  title={t('lookupHint')}
                  aria-label={t('lookup')}
                >
                  <ScanSearch />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setListEntries([entry])}
                  title={t('addToList')}
                  aria-label={t('addToList')}
                >
                  <ListPlus />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ to: '/reader', search: { book: entry.id } })}
                >
                  {t('common:open')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(entry)}
                  title={t('remove')}
                  aria-label={t('remove')}
                >
                  <Trash2 />
                </Button>
              </div>
              {view === 'full' && <BookTags entry={entry} />}
            </li>
              );
            })}
          </ul>
        </div>
      )}

      {lookupEntry && (
        <MetadataDialog entry={lookupEntry} onClose={() => setLookupEntry(null)} onApplied={replaceEntry} />
      )}
      {editEntry && <BookEditDialog entry={editEntry} onClose={() => setEditEntry(null)} onSaved={replaceEntry} />}
      {listEntries && <AddToListDialog entries={listEntries} onClose={() => setListEntries(null)} />}
      {confirmDialog}
    </div>
  );
}

/** A series heading of the grouped view: folds or unfolds its books on click. */
function SeriesHeader({
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

/**
 * Shows `label` (e.g. "3 books") under the pointer while several books are dragged: a row alone
 * would look like one book. The element only has to exist when the browser snapshots it, at the
 * start of the drag, so it is removed right after.
 */
function setCountDragImage(dataTransfer: DataTransfer, label: string): void {
  const badge = document.createElement('div');
  badge.textContent = label;
  badge.className = 'fixed -top-96 left-0 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-md';
  document.body.append(badge);
  dataTransfer.setDragImage(badge, 0, 0);
  setTimeout(() => badge.remove());
}

function ScanProgressBar({ progress, onClose }: { progress: ScanProgress; onClose: () => void }) {
  // The walk reports no total yet, so the bar stays empty until the first file is opened.
  const scanning = progress.phase === 'scanning';
  const done = progress.phase === 'done';
  const { t } = useTranslation('library');

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{scanning ? t('scanning') : `${progress.processed} / ${progress.total}`}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground" title={progress.currentFile}>
          {progress.currentFile}
        </span>
        {done && (
          <Button variant="ghost" size="icon" aria-label={t('scanClose')} title={t('scanClose')} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
      <Progress value={progress.processed} max={progress.total} label={t('scanProgress')} />
    </div>
  );
}

function LibraryToolbar({
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
  view: BookRowView;
  onViewChange: (view: BookRowView) => void;
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

        <SortPicker sort={sort} onChange={onSortChange} disabled={grouped} />

        <ViewModePicker view={view} onChange={onViewChange} />

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

/**
 * Picks the order of the books. Disabled while grouped by series, whose order is fixed (series
 * alphabetically, books by volume).
 */
function SortPicker({
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

/**
 * Above the list: a checkbox ticking every book shown (or none), and, once books are selected,
 * their count and the group actions (add them to a reading list, clear the selection).
 */
function SelectionBar({
  selectedCount,
  shownSelected,
  shown,
  onToggleAll,
  onClear,
  onAddToList,
}: {
  selectedCount: number;
  shownSelected: number;
  shown: number;
  onToggleAll: () => void;
  onClear: () => void;
  onAddToList: () => void;
}) {
  const { t } = useTranslation('library');
  const all = shownSelected === shown;
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-2 px-3 text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
        <input
          type="checkbox"
          checked={all}
          ref={(input) => {
            if (input) input.indeterminate = shownSelected > 0 && !all;
          }}
          onChange={onToggleAll}
          className="size-4"
        />
        {selectedCount === 0 ? t('selectAllShown', { count: shown }) : t('selectedCount', { count: selectedCount })}
      </label>
      {selectedCount > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={onAddToList}>
            <ListPlus />
            {t('addSelectionToList')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X />
            {t('clearSelection')}
          </Button>
        </>
      )}
    </div>
  );
}

/** Picks a *minimum* rating: clicking the 3rd star keeps everything rated 3 and above. */
function RatingFilterPicker({
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
