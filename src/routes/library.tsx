import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FolderOpen, FolderTree, GripVertical, ListPlus, Pencil, ScanSearch, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddToListDialog } from '@/components/add-to-list-dialog';
import { BookDetails, BookRating, BookTags } from '@/components/book-row';
import { BookEditDialog } from '@/components/book-edit-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import { LibraryToolbar } from '@/components/library/library-toolbar';
import { ScanProgressBar } from '@/components/library/scan-progress-bar';
import { SelectionBar } from '@/components/library/selection-bar';
import { SeriesHeader } from '@/components/library/series-header';
import { MetadataDialog } from '@/components/metadata-dialog';
import { Button } from '@/components/ui/button';
import { useLibrary } from '@/hooks/use-library';
import { useOrganizationOffer } from '@/hooks/use-organization-offer';
import { useSettings } from '@/hooks/use-settings';
import { appData } from '@/lib/app-data';
import { availableTags, EMPTY_FILTERS, filterEntries, type LibraryFilters } from '@/lib/library-filter';
import { collapseEditions, editionGroups } from '@/lib/library-editions';
import { groupBySeries, ungroupedRows } from '@/lib/library-groups';
import { sortEntries } from '@/lib/library-sort';
import { draggedEntries, selectedEntries, toggleSelection } from '@/lib/library-selection';
import { encodeDraggedEntries, LIBRARY_ENTRY_DRAG_TYPE, QUICK_TAGS } from '@/lib/reading-list';
import { cn } from '@/lib/utils';
import { comicFormat } from '@/shared/comic';
import type { LibraryEntry, ScanProgress } from '@/shared/library';
import type { BookRowView } from '@/shared/settings';

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
  // The same book in several formats (a CBZ and a PDF) is one row; its other files are its editions.
  const editions = useMemo(() => editionGroups(entries), [entries]);
  const visible = useMemo(
    () => collapseEditions(filterEntries(entries, deferredFilters), editions),
    [entries, deferredFilters, editions],
  );
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
              const formats = editions.get(entry.id);
              const openEntry = (book: LibraryEntry) => void navigate({ to: '/reader', search: { book: book.id } });
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
                  onOpen={() => openEntry(entry)}
                  note={formats && t('editionsNote', { formats: formats.map((e) => comicFormat(e.path)).join(', ') })}
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
                {formats ? (
                  // One button per format: the same book, opened in the file the user prefers.
                  formats.map((edition) => (
                    <Button
                      key={edition.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => openEntry(edition)}
                      title={t('openFormat', { format: comicFormat(edition.path) })}
                      aria-label={t('openFormatNamed', { title: entry.title, format: comicFormat(edition.path) })}
                    >
                      {t('common:open')} {comicFormat(edition.path)}
                    </Button>
                  ))
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => openEntry(entry)}>
                    {t('common:open')}
                  </Button>
                )}
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
