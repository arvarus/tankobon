import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FolderOpen, FolderTree, GripVertical, LayoutList, ListPlus, Rows2, Rows3, Pencil, ScanSearch, Search, Star, Trash2, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { AddToListDialog } from '@/components/add-to-list-dialog';
import { BookCover } from '@/components/book-cover';
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
import { formatPageSize } from '@/lib/image-scan';
import { creditRoleLabel } from '@/lib/metadata-review';
import { encodeDraggedEntry, LIBRARY_ENTRY_DRAG_TYPE, tagLabel, TO_READ_TAG } from '@/lib/reading-list';
import { currentLanguage } from '@/shared/i18n';
import { LanguageFlag } from '@/components/language-flag';
import { languageCountry } from '@/lib/language-flag';
import { cn, formatFileSize, formatLanguage } from '@/lib/utils';
import { comicFormat } from '@/shared/comic';
import { CREDIT_ROLES, READ_TAG, type LibraryEntry, type ScanProgress } from '@/shared/library';
import { type AppSettings } from '@/shared/settings';
import { formatPersonName } from '@/shared/title-parsing';

export const Route = createFileRoute('/')({
  component: LibraryPage,
});

/** Always offered as one-click toggles; any other tag is free-form. */
const QUICK_TAGS = [READ_TAG, TO_READ_TAG];

const NO_ENTRIES: LibraryEntry[] = [];

type LibraryView = AppSettings['libraryView'];

/** Height guessed for a row before it is measured, per display mode. */
const ESTIMATED_ROW_HEIGHT: Record<LibraryView, number> = { full: 128, medium: 104, compact: 49 };

function LibraryPage() {
  const { t } = useTranslation(['library', 'common']);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const offerOrganization = useOrganizationOffer(confirm);
  const navigate = useNavigate();
  const library = useLibrary();
  const { settings, update } = useSettings();
  const view = settings.libraryView;
  const entries = library ?? NO_ENTRIES;
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [lookupEntry, setLookupEntry] = useState<LibraryEntry | null>(null);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [listEntry, setListEntry] = useState<LibraryEntry | null>(null);
  // The input follows the keystrokes; filtering and re-laying out the list can lag behind them.
  const deferredFilters = useDeferredValue(filters);
  const visible = useMemo(() => filterEntries(entries, deferredFilters), [entries, deferredFilters]);
  const tags = useMemo(() => availableTags(entries, QUICK_TAGS), [entries]);

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

  const setRating = (id: string, rating: number) =>
    void appData.patchEntry(id, { rating }, () => window.tankobon.library.updateRating(id, rating));

  const replaceEntry = (updated: LibraryEntry) => appData.upsertEntry(updated);

  const toggleTag = (entry: LibraryEntry, tag: string) => {
    const tags = entry.tags.includes(tag) ? entry.tags.filter((t) => t !== tag) : [...entry.tags, tag];
    void appData.patchEntry(entry.id, { tags }, () => window.tankobon.library.updateTags(entry.id, tags));
  };

  // Only the rows near the viewport exist: a library of tens of thousands of books stays light.
  const scrollRef = useRef<HTMLDivElement>(null);
  // A new search starts from the top, not from wherever the previous results were scrolled to.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [deferredFilters]);
  // The virtualizer's functions aren't memoized, which the React Compiler lint can't know is fine here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT[view],
    getItemKey: (index) => visible[index].id,
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
              const entry = visible[item.index];
              const pageSize = formatPageSize(entry, currentLanguage());
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
                    row opens it. The whole row is the drag image, so the user sees what is carried. */}
                <div
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(LIBRARY_ENTRY_DRAG_TYPE, encodeDraggedEntry(entry));
                    // 'move', like the app's other drags, so the OS shows the same pointer (not the
                    // copy one with a "+"), even though the book stays in the library.
                    event.dataTransfer.effectAllowed = 'move';
                    const row = event.currentTarget.closest('li');
                    if (row) event.dataTransfer.setDragImage(row, 0, 0);
                  }}
                  className="-ml-1 shrink-0 cursor-grab rounded-sm py-2 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
                  title={t('dragHint')}
                  aria-label={t('dragHandle', { title: entry.title })}
                >
                  <GripVertical className="size-4" />
                </div>
                <div
                  role="link"
                  tabIndex={-1}
                  onClick={() => navigate({ to: '/reader', search: { book: entry.id } })}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  {view !== 'compact' && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigate({ to: '/reader', search: { book: entry.id } });
                      }}
                      title={t('common:open')}
                      aria-label={t('openNamed', { title: entry.title })}
                      className="shrink-0 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <BookCover entryId={entry.id} title={entry.title} className="h-20 w-14" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    {view === 'compact' ? (
                      <p className="truncate" title={entry.path}>
                        <span className="font-medium">{entry.title}</span>
                        <span className="text-xs text-muted-foreground">{seriesLine(entry, t) && ` — ${seriesLine(entry, t)}`}</span>
                      </p>
                    ) : (
                      <>
                        <p className="truncate font-medium" title={entry.path}>
                          {entry.title}
                        </p>
                        {view === 'full' ? (
                          <EntryMetadata entry={entry} />
                        ) : (
                          <p className="truncate text-xs">{seriesLine(entry, t)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {(view === 'full'
                            ? [
                                t('common:pageOf', { page: entry.currentPage + 1, total: entry.pageCount }),
                                comicFormat(entry.path),
                                t('fileCount', { count: entry.fileCount }),
                                formatFileSize(entry.fileSize),
                                pageSize && t('pageSize', { size: pageSize }),
                              ]
                            : [t('common:pageOf', { page: entry.currentPage + 1, total: entry.pageCount })]
                          ).filter(Boolean).join(' · ')}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {view !== 'compact' && (
                  <StarRating rating={entry.rating} onChange={(rating) => setRating(entry.id, rating)} />
                )}
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
                  onClick={() => setListEntry(entry)}
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
              {view === 'full' && <TagEditor entry={entry} onToggle={(tag) => toggleTag(entry, tag)} />}
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
      {listEntry && <AddToListDialog entry={listEntry} onClose={() => setListEntry(null)} />}
      {confirmDialog}
    </div>
  );
}

/** "Series · Vol. 3": what the medium and compact views show under or next to the title. */
function seriesLine(entry: LibraryEntry, t: TFunction<['library', 'common']>): string {
  return [entry.series, entry.volume && t('volumeShort', { volume: entry.volume })].filter(Boolean).join(' · ');
}

/** Series, volume, date, language and credits found by a metadata lookup; nothing when there are none. */
function EntryMetadata({ entry }: { entry: LibraryEntry }) {
  const { t } = useTranslation(['library', 'common']);
  const series = [entry.series, entry.volume && t('volumeShort', { volume: entry.volume })].filter(Boolean).join(' · ');
  const languageName = formatLanguage(entry.language);
  const language = languageCountry(entry.language) ? (
    <span key="language" title={languageName ?? undefined}>
      <LanguageFlag code={entry.language} className="align-[-1px]" />
    </span>
  ) : (
    languageName
  );
  const details = [series, entry.releaseDate?.slice(0, 4), language].filter(Boolean);
  const credits = CREDIT_ROLES.flatMap((role) => {
    const names = entry.credits.filter((credit) => credit.role === role).map(formatPersonName);
    return names.length > 0 ? [t('common:labelValue', { label: creditRoleLabel(role), value: names.join(', ') })] : [];
  });
  if (details.length === 0 && credits.length === 0) return null;

  return (
    <p className="truncate text-xs" title={credits.join('\n') || undefined}>
      {details.flatMap((detail, index) => (index === 0 ? [detail] : [' · ', detail]))}
      {details.length > 0 && credits.length > 0 && ' — '}
      <span className="text-muted-foreground">{credits.join(' · ')}</span>
    </p>
  );
}

function StarRating({ rating, onChange }: { rating: number; onChange: (rating: number) => void }) {
  const { t } = useTranslation('library');
  return (
    <div className="flex shrink-0 items-center gap-0.5" title={rating > 0 ? t('rating', { rating }) : t('notRated')}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          // Clicking the star that already sets the current rating clears it.
          onClick={() => onChange(value === rating ? 0 : value)}
          aria-label={t('rate', { count: value })}
          className="text-muted-foreground hover:text-yellow-500"
        >
          <Star className={cn('size-4', value <= rating && 'fill-yellow-400 text-yellow-500')} />
        </button>
      ))}
    </div>
  );
}

function TagEditor({ entry, onToggle }: { entry: LibraryEntry; onToggle: (tag: string) => void }) {
  const { t } = useTranslation('library');
  const [newTag, setNewTag] = useState('');
  const customTags = entry.tags.filter((tag) => !QUICK_TAGS.includes(tag));

  const addCustomTag = () => {
    const tag = newTag.trim();
    if (tag && !entry.tags.includes(tag)) {
      onToggle(tag);
    }
    setNewTag('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onToggle(tag)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs',
            entry.tags.includes(tag)
              ? 'border-primary bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          {tagLabel(tag)}
        </button>
      ))}
      {customTags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
          <button type="button" onClick={() => onToggle(tag)} aria-label={t('removeTag', { tag })}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={newTag}
        onChange={(event) => setNewTag(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addCustomTag();
          }
        }}
        placeholder={t('newTag')}
        className="w-24 rounded-full border border-dashed bg-transparent px-2 py-0.5 text-xs outline-none focus:border-solid focus:border-primary"
      />
    </div>
  );
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
}: {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  tags: string[];
  shown: number;
  total: number;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
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

        <ViewModePicker view={view} onChange={onViewChange} />

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

/** Switches the library's display mode: one icon button per mode. */
function ViewModePicker({ view, onChange }: { view: LibraryView; onChange: (view: LibraryView) => void }) {
  const { t } = useTranslation('library');
  const modes = [
    { value: 'full', Icon: LayoutList, label: t('viewFull') },
    { value: 'medium', Icon: Rows2, label: t('viewMedium') },
    { value: 'compact', Icon: Rows3, label: t('viewCompact') },
  ] as const;
  return (
    <div role="group" aria-label={t('viewMode')} className="flex items-center gap-0.5 rounded-md border p-0.5">
      {modes.map(({ value, Icon, label }) => (
        <Button
          key={value}
          variant={view === value ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => onChange(value)}
          aria-pressed={view === value}
          title={label}
          aria-label={label}
        >
          <Icon />
        </Button>
      ))}
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
    <div className="flex items-center gap-1 rounded-md border px-2 py-1">
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
