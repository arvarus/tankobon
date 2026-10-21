import { writeFile } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';

import type { ClearLibraryResult, ExportResult, ImportResult } from '../../shared/data';
import { t } from '../../shared/i18n';
import { buildExport, exportFileName } from '../db/export-service';
import { applyImport, parseExport, readExportFile } from '../db/import-service';
import type { DecoderClient } from '../decoder/decoder-client';
import type { LibraryRepository } from '../db/library-repository';
import type { ImageStatsScanner } from '../services/image-stats-scanner';
import type { ReadingListRepository } from '../db/reading-list-repository';
import type { SettingsRepository } from '../db/settings-repository';
import { applyMainLanguage } from '../language';
import type { NotifyDataChange } from './data-changes';
import { openDialogFor, saveDialogFor } from './dialogs';
import { handle } from './handle';
import { args } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const DATA_CHANNELS = {
  export: 'data:export',
  import: 'data:import',
  clearLibrary: 'data:clear-library',
} as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerDataIpc(
  db: DatabaseSync,
  libraryRepo: LibraryRepository,
  settingsRepo: SettingsRepository,
  readingListRepo: ReadingListRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
  imageScanner: ImageStatsScanner,
): void {
  handle(DATA_CHANNELS.export, args(), async (event): Promise<ExportResult> => {
    const options: Electron.SaveDialogOptions = {
      title: t('dialogs:exportData'),
      defaultPath: exportFileName(new Date()),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const { canceled, filePath } = await saveDialogFor(event, options);
    if (canceled || !filePath) {
      return { status: 'cancelled' };
    }

    try {
      const data = buildExport(libraryRepo, settingsRepo, readingListRepo);
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { status: 'exported', filePath };
    } catch (error) {
      return { status: 'error', message: t('errors:data.exportFailed', { message: errorMessage(error) }) };
    }
  });

  handle(DATA_CHANNELS.import, args(), async (event): Promise<ImportResult> => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:importData'),
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return { status: 'cancelled' };
    }

    try {
      const data = parseExport(await readExportFile(filePaths[0]));
      const counts = applyImport(db, libraryRepo, settingsRepo, readingListRepo, data);
      // The settings were replaced, the language with them.
      applyMainLanguage(settingsRepo.getAll().language);
      decoder.setSidecarCovers(settingsRepo.getAll().librarySidecarCovers);
      notify({ scope: 'library' });
      notify({ scope: 'readingLists' });
      notify({ scope: 'settings' });
      // Thumbnails aren't part of an export: rebuild the cache in the background, without making
      // the import wait for every archive to be opened.
      void decoder.rebuildThumbnails(libraryRepo.list().map((entry) => entry.path)).catch(() => undefined);
      // Same for the pages' sizes of the books the snapshot doesn't carry them for.
      void imageScanner.kick();
      return { status: 'imported', filePath: filePaths[0], ...counts };
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  });

  handle(DATA_CHANNELS.clearLibrary, args(), async (): Promise<ClearLibraryResult> => {
    try {
      const readingLists = readingListRepo.clear();
      const entries = libraryRepo.clear();
      notify({ scope: 'library' });
      notify({ scope: 'readingLists' });
      // Every thumbnail now belongs to a book that is no longer in the library.
      await decoder.pruneThumbnails([]);
      return { status: 'cleared', entries, readingLists };
    } catch (error) {
      return { status: 'error', message: t('errors:data.clearFailed', { message: errorMessage(error) }) };
    }
  });
}
