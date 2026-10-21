import { createFileRoute } from '@tanstack/react-router';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsSection } from '@/components/settings-section';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useLibrary } from '@/hooks/use-library';
import { useReadingLists } from '@/hooks/use-reading-lists';
import { cn } from '@/lib/utils';
import type { DatabaseLocation } from '@/shared/data';

export const Route = createFileRoute('/settings/data')({
  component: DataSettingsPage,
});

function DataSettingsPage() {
  const { t } = useTranslation(['settings', 'common']);
  const library = useLibrary();
  const readingLists = useReadingLists();
  const [dataStatus, setDataStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [dbLocation, setDbLocation] = useState<DatabaseLocation | null>(null);
  // A location change only takes effect on the next start, so the app has to offer a restart.
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  // What is typed in the file name field; null while it shows the current name.
  const [fileNameDraft, setFileNameDraft] = useState<string | null>(null);
  // What clearing would delete, shown in the confirmation dialog; null while it's closed.
  const [clearCounts, setClearCounts] = useState<{ entries: number; readingLists: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<{ message: string; error?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.tankobon.database.getLocation().then((location) => {
      if (!cancelled) setDbLocation(location);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseDatabaseLocation = async () => {
    const result = await window.tankobon.database.chooseLocation();
    if (result.status === 'cancelled') {
      return;
    }
    if (result.status === 'error') {
      setDbError(result.message);
      return;
    }
    setDbError(null);
    setDbLocation(result.location);
    setRestartNeeded(true);
  };

  const applyFileName = async (fileName: string | null) => {
    const result = await window.tankobon.database.setFileName(fileName);
    if (result.status === 'error') {
      setDbError(result.message);
      return;
    }
    if (result.status === 'changed') {
      setDbError(null);
      setDbLocation(result.location);
      setFileNameDraft(null);
      setRestartNeeded(true);
    }
  };

  const resetDatabaseLocation = async () => {
    setDbError(null);
    setDbLocation(await window.tankobon.database.resetLocation());
    setRestartNeeded(true);
  };

  const exportData = async () => {
    const result = await window.tankobon.data.export();
    if (result.status === 'cancelled') {
      setDataStatus(null);
      return;
    }
    if (result.status === 'error') {
      setDataStatus({ message: result.message, error: true });
      return;
    }
    setDataStatus({ message: t('data.exported', { filePath: result.filePath }) });
  };

  const importData = async () => {
    const result = await window.tankobon.data.import();
    if (result.status === 'cancelled') {
      setDataStatus(null);
      return;
    }
    if (result.status === 'error') {
      setDataStatus({ message: result.message, error: true });
      return;
    }
    setDataStatus({
      message: t('data.imported', { count: result.added, updated: result.updated, filePath: result.filePath }),
    });
  };

  const askClearLibrary = () => {
    setClearStatus(null);
    setClearCounts({ entries: library?.length ?? 0, readingLists: readingLists?.length ?? 0 });
  };

  const clearLibrary = async () => {
    setClearing(true);
    try {
      const result = await window.tankobon.data.clearLibrary();
      if (result.status === 'error') {
        setClearStatus({ message: result.message, error: true });
        return;
      }
      setClearStatus({ message: t('data.cleared', { entries: result.entries, count: result.readingLists }) });
    } finally {
      setClearing(false);
      setClearCounts(null);
    }
  };

  return (
    <>
      <SettingsSection title={t('data.importExport')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download />
            {t('data.export')}
          </Button>
          <Button variant="outline" onClick={importData}>
            <Upload />
            {t('data.import')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('data.importHint')}</p>
        {dataStatus && (
          <p className={cn('text-sm', dataStatus.error ? 'text-destructive' : 'text-muted-foreground')}>
            {dataStatus.message}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title={t('data.location')}>
        <p className="font-mono text-sm break-all text-muted-foreground">
          {dbLocation ? dbLocation.filePath : '…'}
          {dbLocation?.isDefault && t('data.defaultLocation')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={chooseDatabaseLocation}>
            <Database />
            {t('data.changeFolder')}
          </Button>
          {dbLocation && !dbLocation.isDefault && (
            <Button variant="outline" onClick={resetDatabaseLocation}>
              {t('data.resetLocation')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('data.locationHint')}</p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (fileNameDraft !== null) void applyFileName(fileNameDraft);
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            {t('data.fileName')}
            <input
              className="h-8 w-56 rounded-md border bg-background px-2 font-mono"
              maxLength={100}
              value={fileNameDraft ?? dbLocation?.fileName ?? ''}
              onChange={(event) => setFileNameDraft(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={fileNameDraft === null || fileNameDraft === dbLocation?.fileName}>
            {t('data.fileNameApply')}
          </Button>
          {dbLocation && !dbLocation.isDefaultFileName && (
            <Button type="button" variant="outline" size="sm" onClick={() => void applyFileName(null)}>
              {t('data.resetFileName')}
            </Button>
          )}
        </form>
        <p className="text-sm text-muted-foreground">{t('data.fileNameHint')}</p>
        {dbError && <p className="text-sm text-destructive">{dbError}</p>}
        {restartNeeded && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{t('data.restartNeeded')}</p>
            <Button size="sm" onClick={() => void window.tankobon.database.relaunch()}>
              {t('data.restartNow')}
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t('data.clear')}>
        <p className="text-sm text-muted-foreground">{t('data.clearHint')}</p>
        <div>
          <Button variant="destructive" onClick={askClearLibrary}>
            <Trash2 />
            {t('data.clearButton')}
          </Button>
        </div>
        {clearStatus && (
          <p className={cn('text-sm', clearStatus.error ? 'text-destructive' : 'text-muted-foreground')}>
            {clearStatus.message}
          </p>
        )}
      </SettingsSection>

      <Dialog
        open={clearCounts !== null}
        onOpenChange={(open) => !open && !clearing && setClearCounts(null)}
        title={t('data.clearConfirmTitle')}
        description={t('data.clearConfirmDescription')}
        className="max-w-md"
      >
        {clearCounts && (
          <p className="text-sm">
            {t('data.clearConfirm', { entries: clearCounts.entries, count: clearCounts.readingLists })}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={clearing} onClick={() => setClearCounts(null)}>
            {t('common:cancel')}
          </Button>
          <Button variant="destructive" disabled={clearing} onClick={() => void clearLibrary()}>
            <Trash2 />
            {t('data.clearAction')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
