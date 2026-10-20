import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/utils';
import type { CleanupAnalysisResult, CleanupResult } from '@/shared/library';

type Analysis = Extract<CleanupAnalysisResult, { status: 'ok' }>;

/**
 * Cleans the books of the files that are not images. It analyzes first (`ids`, the whole library
 * when empty), shows what each kind of file would cost, lets the user untick the kinds to keep,
 * and only then rewrites the archives. Only CBZ can be rewritten; the others are counted as skipped.
 */
export function CleanupDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { t } = useTranslation(['library', 'common']);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<Extract<CleanupResult, { status: 'ok' }> | null>(null);
  // The kinds of files (extensions) the user wants to keep.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.tankobon.library
      .analyzeCleanup(ids)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.status === 'error') setError(outcome.message);
        else setAnalysis(outcome);
      })
      .catch(() => !cancelled && setError(t('library:cleanupFailed')))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // Analysed once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toRemove = analysis?.groups.filter((group) => !kept.has(group.extension)) ?? [];
  const filesToRemove = toRemove.reduce((sum, group) => sum + group.files, 0);
  const sizeToRemove = toRemove.reduce((sum, group) => sum + group.size, 0);

  const toggle = (extension: string) =>
    setKept((current) => {
      const next = new Set(current);
      if (!next.delete(extension)) next.add(extension);
      return next;
    });

  const apply = async () => {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await window.tankobon.library.applyCleanup(analysis.token, [...kept]);
      if (outcome.status === 'error') setError(outcome.message);
      else setResult(outcome);
    } catch {
      setError(t('library:cleanupFailed'));
    }
    setBusy(false);
  };

  const finished = result !== null;
  const nothingToClean = analysis !== null && analysis.groups.length === 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={t('library:cleanupTitle')}
      description={t('library:cleanupIntro')}
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-auto">
        {busy && !analysis && <p className="text-sm text-muted-foreground">{t('library:cleanupAnalyzing')}</p>}
        {busy && analysis && <p className="text-sm text-muted-foreground">{t('library:cleanupApplying')}</p>}

        {analysis && !finished && !nothingToClean && (
          <>
            <p className="text-sm">
              {t('library:cleanupSummary', { books: analysis.booksWithJunk, scanned: analysis.scanned })}
            </p>
            <ul className="flex flex-col gap-1.5">
              {analysis.groups.map((group) => (
                <li key={group.extension}>
                  <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!kept.has(group.extension)}
                      disabled={busy}
                      onChange={() => toggle(group.extension)}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {group.extension === '' ? t('library:cleanupNoExtension') : group.extension}
                        <span className="font-normal text-muted-foreground">
                          {' · '}
                          {t('library:cleanupGroup', {
                            files: group.files,
                            books: group.books,
                            size: formatFileSize(group.size),
                          })}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground" title={group.examples.join(', ')}>
                        {group.examples.join(', ')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t('library:cleanupHint')}</p>
          </>
        )}

        {nothingToClean && !finished && <p className="text-sm">{t('library:cleanupNothing')}</p>}

        {analysis && !finished && (analysis.skipped > 0 || analysis.failed > 0) && (
          <p className="text-xs text-muted-foreground">
            {[
              analysis.skipped > 0 ? t('library:cleanupSkipped', { count: analysis.skipped }) : '',
              analysis.failed > 0 ? t('library:cleanupUnreadable', { count: analysis.failed }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
        )}

        {result && (
          <>
            <p className="text-sm">
              {t('library:cleanupDone', {
                books: result.cleaned,
                files: result.filesRemoved,
                size: formatFileSize(result.bytesFreed),
              })}
            </p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive">{t('library:cleanupRewriteFailed', { count: result.failed })}</p>
            )}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex justify-end gap-2">
        {finished || nothingToClean || !analysis ? (
          <Button onClick={onClose} disabled={busy}>
            {t('common:close')}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t('common:cancel')}
            </Button>
            <Button onClick={apply} disabled={busy || filesToRemove === 0}>
              {t('library:cleanupApply', { count: filesToRemove, size: formatFileSize(sizeToRemove) })}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
