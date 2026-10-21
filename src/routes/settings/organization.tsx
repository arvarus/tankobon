import { createFileRoute } from '@tanstack/react-router';
import { Copy, Eraser, FolderTree, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CleanupDialog } from '@/components/cleanup-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import { DuplicatesDialog } from '@/components/duplicates-dialog';
import { ScanFailuresDialog } from '@/components/scan-failures-dialog';
import { SETTINGS_SELECT_CLASS, SettingsSection } from '@/components/settings-section';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useOrganizationOffer } from '@/hooks/use-organization-offer';
import { useLibrary } from '@/hooks/use-library';
import { useSettings } from '@/hooks/use-settings';
import { duplicateGroups } from '@/lib/library-editions';
import { fileNameExample, levelChoices, setLevel, structureExample } from '@/lib/library-structure';
import { cn } from '@/lib/utils';
import { FILE_NAME_FIELDS, MAX_FILE_NAME_TEMPLATE_LENGTH, fileNameTemplateError } from '@/shared/file-name-template';
import type { LibraryEntry, ScanFailure, ScanProgress } from '@/shared/library';
import {
  MAX_LIBRARY_LEVELS,
  isLibraryStructure,
  type LibraryLevel,
  type LibraryOrganization,
} from '@/shared/settings';

export const Route = createFileRoute('/settings/organization')({
  component: OrganizationSettingsPage,
});

/**
 * How the library's files are laid out, shared by every user. The folder the files are moved to is
 * each user's own choice (Paramètres › Bibliothèque).
 */
function OrganizationSettingsPage() {
  const { t, i18n } = useTranslation('settings', { keyPrefix: 'library' });
  const { settings, update } = useSettings();
  const { t: tLibrary } = useTranslation('library');
  const library = useLibrary();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const offerOrganization = useOrganizationOffer(confirm);
  // The groups found, frozen when the dialog opens.
  const [duplicates, setDuplicates] = useState<LibraryEntry[][] | null>(null);
  const [duplicatesStatus, setDuplicatesStatus] = useState<string | null>(null);
  // Whether the cleanup dialog is open (it always works on the whole library).
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  // Whether this page started the run, to show its progress here (a run started elsewhere only disables the controls).
  const [running, setRunning] = useState(false);
  // The files the last resynchronization couldn't open (`total` is the exact count), shown in a dialog on request.
  const [failures, setFailures] = useState<{ list: ScanFailure[]; total: number } | null>(null);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const [resyncRunning, setResyncRunning] = useState(false);
  const [resyncStatus, setResyncStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [organizeStatus, setOrganizeStatus] = useState<{ message: string; error?: boolean } | null>(null);
  // A resynchronization or an organization: either one blocks the other.
  const busy = progress !== null;

  // Also shows a run started at launch, or from another window.
  useEffect(() => window.tankobon.library.onScanProgress((p) => setProgress(p.phase === 'done' ? null : p)), []);

  const organizeAll = async () => {
    setOrganizeStatus(null);
    const count = await window.tankobon.library.countUnorganized();
    if (count.status === 'error') {
      setOrganizeStatus({ message: count.message, error: true });
      return;
    }
    if (count.count === 0) {
      setOrganizeStatus({ message: t('organizeAllNone') });
      return;
    }
    const accepted = await confirm({
      title: t('organizeAllConfirmTitle'),
      message: t('organizeAllConfirm', { count: count.count, folder: count.folder }),
      action: t('organizeAllAction'),
    });
    if (!accepted) return;
    setRunning(true);
    setProgress({ phase: 'importing', processed: 0, total: count.count, currentFile: '' });
    const result = await window.tankobon.library.organizeAll();
    setProgress(null);
    setRunning(false);
    if (result.status === 'error') {
      setOrganizeStatus({ message: result.message, error: true });
      return;
    }
    const parts = [t('organizeAllDone', { count: result.moved })];
    if (result.failed > 0) parts.push(t('organizeAllFailed', { count: result.failed }));
    setOrganizeStatus({ message: parts.join(' · ') });
  };

  const resync = async () => {
    setResyncStatus(null);
    setFailures(null);
    setResyncRunning(true);
    setProgress({ phase: 'scanning', processed: 0, total: 0, currentFile: '' });
    const result = await window.tankobon.library.resync();
    setProgress(null);
    setResyncRunning(false);
    if (result.status === 'error') {
      setResyncStatus({ message: result.message, error: true });
      return;
    }
    if (result.failed > 0) setFailures({ list: result.failures, total: result.failed });
    const parts = [t('resyncDone', { added: result.added, removed: result.removed })];
    if (result.failed > 0) parts.push(t('resyncFailed', { count: result.failed }));
    if (result.nfoWritten > 0) parts.push(t('resyncNfoWritten', { count: result.nfoWritten }));
    if (result.coversExtracted > 0) parts.push(t('resyncCoversExtracted', { count: result.coversExtracted }));
    if (result.unreachable > 0) parts.push(t('resyncUnreachable', { count: result.unreachable }));
    setResyncStatus({ message: parts.join(' · ') });
    parts.push(...(await offerOrganization(result.organization)));
    setResyncStatus({ message: parts.join(' · ') });
  };

  const lastResync = settings.lastResyncAt
    ? t('lastResync', { date: new Date(settings.lastResyncAt).toLocaleString(i18n.language) })
    : t('neverResynced');

  const findDuplicates = () => {
    const groups = duplicateGroups(library ?? []);
    if (groups.length === 0) setDuplicatesStatus(tLibrary('duplicatesNone'));
    else {
      setDuplicatesStatus(null);
      setDuplicates(groups);
    }
  };

  return (
    <>
      <SettingsSection title={t('organization')}>
        <p className="text-sm text-muted-foreground">{t('organizationHint')}</p>
        <div className="flex items-center gap-2">
          <label htmlFor="library-organization" className="text-sm">
            {t('organizationMode')}
          </label>
          <select
            id="library-organization"
            className={SETTINGS_SELECT_CLASS}
            value={settings.libraryOrganization}
            onChange={(event) => update('libraryOrganization', event.target.value as LibraryOrganization)}
          >
            <option value="off">{t('organizationOff')}</option>
            <option value="ask">{t('organizationAsk')}</option>
            <option value="always">{t('organizationAlways')}</option>
          </select>
        </div>
        <p className="text-sm text-muted-foreground">
          {settings.libraryOrganizationFolder ? t('organizationFolderIs', { folder: settings.libraryOrganizationFolder }) : t('organizationFolderNone')}
        </p>
        <StructureEditor disabled={busy} />
        <FileNameEditor disabled={busy} />
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.librarySidecarCovers}
              onChange={(event) => update('librarySidecarCovers', event.target.checked)}
            />
            {t('sidecarCovers')}
          </label>
          <p className="text-sm text-muted-foreground">{t('sidecarCoversHint')}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.libraryWriteNfo}
              onChange={(event) => update('libraryWriteNfo', event.target.checked)}
            />
            {t('writeNfo')}
          </label>
          <p className="text-sm text-muted-foreground">{t('writeNfoHint')}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t('organizeAllHint')}</p>
        <div>
          <Button
            variant="outline"
            onClick={() => void organizeAll()}
            disabled={busy || settings.libraryOrganization === 'off' || !settings.libraryOrganizationFolder}
          >
            <FolderTree />
            {running ? t('organizeAllRunning') : t('organizeAll')}
          </Button>
        </div>
        {progress && running && (
          <Progress value={progress.processed} max={progress.total} label={t('organizeAllRunning')} />
        )}
        {organizeStatus && (
          <p className={cn('text-sm', organizeStatus.error ? 'text-destructive' : 'text-muted-foreground')}>
            {organizeStatus.message}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t('duplicatesHint')}</p>
        <div>
          <Button variant="outline" onClick={findDuplicates} disabled={library === null}>
            <Copy />
            {t('duplicates')}
          </Button>
        </div>
        {duplicatesStatus && <p className="text-sm text-muted-foreground">{duplicatesStatus}</p>}
        <p className="text-sm text-muted-foreground">{t('cleanupHint')}</p>
        <div>
          <Button variant="outline" onClick={() => setCleanupOpen(true)} disabled={busy}>
            <Eraser />
            {t('cleanup')}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title={t('resync')}>
        <p className="text-sm text-muted-foreground">{t('resyncHint')}</p>
        <div>
          <Button variant="outline" onClick={() => void resync()} disabled={busy}>
            <RefreshCw />
            {resyncRunning ? t('resyncRunning') : t('resyncButton')}
          </Button>
        </div>
        {progress && progress.phase === 'importing' && resyncRunning && (
          <Progress value={progress.processed} max={progress.total} label={t('resyncRunning')} />
        )}
        {resyncStatus && (
          <p className={cn('text-sm', resyncStatus.error ? 'text-destructive' : 'text-muted-foreground')}>
            {resyncStatus.message}
          </p>
        )}
        {failures && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setFailuresOpen(true)}>
              {t('resyncShowFailures')}
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{lastResync}</p>
        <div className="flex items-center gap-2">
          <input
            id="resync-on-startup"
            type="checkbox"
            checked={settings.resyncOnStartup}
            onChange={(event) => update('resyncOnStartup', event.target.checked)}
          />
          <label htmlFor="resync-on-startup" className="text-sm">
            {t('resyncOnStartup')}
          </label>
        </div>
      </SettingsSection>
      {duplicates && <DuplicatesDialog groups={duplicates} onClose={() => setDuplicates(null)} />}
      {cleanupOpen && <CleanupDialog ids={[]} onClose={() => setCleanupOpen(false)} />}
      {confirmDialog}
      {failures && failuresOpen && (
        <ScanFailuresDialog failures={failures.list} total={failures.total} onClose={() => setFailuresOpen(false)} />
      )}
    </>
  );
}

/**
 * The organized folder's tree: up to three levels, each a `<select>`. A tree the setting can't hold
 * yet (a letter grouping without a second level) stays a local draft until it is completed.
 */
function StructureEditor({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation('settings', { keyPrefix: 'library' });
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState<LibraryLevel[]>(settings.libraryStructure);
  // Follows a change of the setting, whoever makes it (this page, another window, a data import);
  // React's "adjust state while rendering" pattern, so the selects never show a stale tree.
  const [stored, setStored] = useState(settings.libraryStructure);
  if (stored !== settings.libraryStructure) {
    setStored(settings.libraryStructure);
    setDraft(settings.libraryStructure);
  }

  const change = (index: number, value: string) => {
    const next = setLevel(draft, index, value === '' ? null : (value as LibraryLevel));
    setDraft(next);
    if (isLibraryStructure(next)) update('libraryStructure', next);
  };

  const example = structureExample(draft, settings.libraryFileName);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{t('structure')}</span>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: MAX_LIBRARY_LEVELS }, (_, index) => {
          const choices = levelChoices(draft, index);
          return (
            <select
              key={index}
              aria-label={t('structureLevel', { level: index + 1 })}
              className={SETTINGS_SELECT_CLASS}
              value={draft[index] ?? ''}
              disabled={disabled || choices.length === 0}
              onChange={(event) => change(index, event.target.value)}
            >
              <option value="">{index === 0 ? t('structurePerComic') : t('structureNone')}</option>
              {choices.map((level) => (
                <option key={level} value={level}>
                  {t(`levels.${level}`)}
                </option>
              ))}
            </select>
          );
        })}
      </div>
      {!isLibraryStructure(draft) ? (
        <p className="text-sm text-destructive">{t('structureLetterNeedsNext')}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {example ? t('structureExample', { path: example }) : t('structurePerComicHint')}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t('structureHint')}</p>
    </div>
  );
}

/**
 * The file name template: a text field saved as it is typed, as long as it is valid; an invalid one
 * (a `/`, an unknown field) stays a local draft, with its error, until it is fixed.
 */
function FileNameEditor({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation('settings', { keyPrefix: 'library' });
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings.libraryFileName);
  // Follows a change of the setting made elsewhere, like the tree above.
  const [stored, setStored] = useState(settings.libraryFileName);
  if (stored !== settings.libraryFileName) {
    setStored(settings.libraryFileName);
    setDraft(settings.libraryFileName);
  }

  const change = (value: string) => {
    setDraft(value);
    if (fileNameTemplateError(value) === null) update('libraryFileName', value);
  };

  const error = fileNameTemplateError(draft);
  const fields = FILE_NAME_FIELDS.map((field) => `{${field}}`).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="library-file-name" className="text-sm">
        {t('fileName')}
      </label>
      <input
        id="library-file-name"
        type="text"
        spellCheck={false}
        autoComplete="off"
        maxLength={MAX_FILE_NAME_TEMPLATE_LENGTH}
        placeholder={t('fileNamePlaceholder')}
        className="w-full max-w-md rounded-md border bg-background px-3 py-1.5 font-mono text-sm"
        value={draft}
        disabled={disabled}
        aria-invalid={error !== null}
        onChange={(event) => change(event.target.value)}
      />
      {error ? (
        <p className="text-sm text-destructive">{t(`fileNameErrors.${error}`, { fields })}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('structureExample', { path: fileNameExample(draft) })}</p>
      )}
      <p className="text-sm text-muted-foreground">{t('fileNameHint', { fields })}</p>
    </div>
  );
}
