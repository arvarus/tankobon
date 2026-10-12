import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FolderOpen, Trash2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/confirm-dialog';
import { ContinuousReader } from '@/components/reader/continuous-reader';
import { SinglePageReader } from '@/components/reader/single-page-reader';
import { Button } from '@/components/ui/button';
import { useOpeningAchievements } from '@/hooks/use-achievements';
import { useComic } from '@/hooks/use-comic';
import { useLibrary } from '@/hooks/use-library';
import { useNextInList } from '@/hooks/use-next-in-list';
import { useReaderFullscreen } from '@/hooks/use-reader-fullscreen';
import { useReadingTime } from '@/hooks/use-reading-time';
import { useSettings } from '@/hooks/use-settings';

interface ReaderSearch {
  /** Library entry id, or file-dialog token, of a comic to open automatically, e.g. from the library page. */
  book?: string;
  /** Id of the reading list the comic was opened from: its next book is offered on the last page. */
  list?: string;
}

export const Route = createFileRoute('/reader')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => ({
    book: typeof search.book === 'string' ? search.book : undefined,
    list: typeof search.list === 'string' ? search.list : undefined,
  }),
  component: ReaderPage,
});

function ReaderPage() {
  const { book, list } = Route.useSearch();
  const { t } = useTranslation('reader');
  const { t: tLibrary } = useTranslation('library');
  const { settings } = useSettings();
  const library = useLibrary();
  const navigate = useNavigate();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { comic, page, pageUrl, error, loading, pickAndOpen, openFile, close, next, prev } = useComic({
    loadPages: settings.readingMode !== 'continuous',
  });
  const { fullscreen, toggle: toggleFullscreen } = useReaderFullscreen(comic !== null);
  const nextInList = useNextInList(list, comic?.libraryId ?? undefined);
  useOpeningAchievements(comic?.id ?? null);
  useReadingTime(comic?.libraryId ?? null);

  useEffect(() => {
    if (book) void openFile(book);
  }, [book, openFile]);

  // Continuous mode doesn't drive `page`/`goTo` (that would also re-trigger useComic's
  // own single-page fetch for no reason); it persists progress directly instead.
  const persistProgress = useCallback(
    (index: number) => {
      if (!comic?.libraryId) return;
      void window.tankobon.library.updateProgress(comic.libraryId, index);
    },
    [comic],
  );

  // A library book that fails to open (missing, corrupted, unsupported) can be dropped from the library.
  const failedEntry = !comic && error && book ? library?.find((entry) => entry.id === book) : undefined;

  const removeFailedEntry = async () => {
    if (!failedEntry) return;
    const confirmed = await confirm({
      title: tLibrary('confirmRemoveTitle'),
      message: tLibrary('confirmRemove', { title: failedEntry.title }),
      action: tLibrary('confirmRemoveAction'),
    });
    if (!confirmed) return;
    await window.tankobon.library.remove(failedEntry.id);
    void navigate({ to: '/library' });
  };

  if (!comic) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
        <Button onClick={pickAndOpen} disabled={loading}>
          <FolderOpen />
          {t('openFile')}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {failedEntry && (
          <Button variant="outline" onClick={removeFailedEntry}>
            <Trash2 />
            {t('removeFromLibrary')}
          </Button>
        )}
        {confirmDialog}
      </div>
    );
  }

  if (settings.readingMode === 'continuous') {
    return (
      <ContinuousReader
        key={comic.id}
        comic={comic}
        spacing={settings.pageSpacing}
        pickAndOpen={pickAndOpen}
        close={close}
        onActivePage={persistProgress}
        fullscreen={fullscreen}
        toggleFullscreen={toggleFullscreen}
        background={settings.readerBackground}
        nextInList={nextInList}
      />
    );
  }

  return (
    <SinglePageReader
      comic={comic}
      page={page}
      pageUrl={pageUrl}
      error={error}
      loading={loading}
      pickAndOpen={pickAndOpen}
      close={close}
      next={next}
      prev={prev}
      settings={settings}
      fullscreen={fullscreen}
      toggleFullscreen={toggleFullscreen}
      nextInList={nextInList}
    />
  );
}
