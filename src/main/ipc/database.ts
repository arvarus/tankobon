import { app } from 'electron';

import type { DatabaseLocation, DatabaseLocationResult } from '../../shared/data';
import { t } from '../../shared/i18n';
import { databaseLocation } from '../db/database';
import {
  checkDirectoryUsable,
  normalizeDatabaseFileName,
  writeFileNamePointer,
  writeLocationPointer,
} from '../db/db-location';
import { openDialogFor } from './dialogs';
import { handle } from './handle';
import { args, expectNullableString } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const DATABASE_CHANNELS = {
  getLocation: 'database:get-location',
  chooseLocation: 'database:choose-location',
  resetLocation: 'database:reset-location',
  setFileName: 'database:set-file-name',
  relaunch: 'database:relaunch',
} as const;

/**
 * Changing the location only rewrites the pointer file: the database already open stays open, and
 * the new one is picked up on the next start. Moving the existing file is deliberately not done —
 * pointing at a directory that already holds a `tankobon.db` (a synced folder, another machine)
 * has to keep that database rather than overwrite it.
 */
export function registerDatabaseIpc(): void {
  handle(DATABASE_CHANNELS.getLocation, args(), (): DatabaseLocation => databaseLocation());

  handle(DATABASE_CHANNELS.chooseLocation, args(), async (event): Promise<DatabaseLocationResult> => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:chooseDatabaseFolder'),
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: databaseLocation().directory,
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return { status: 'cancelled' };
    }

    const directory = filePaths[0];
    const problem = checkDirectoryUsable(directory);
    if (problem) {
      return { status: 'error', message: problem };
    }

    writeLocationPointer(app.getPath('userData'), directory);
    return { status: 'changed', location: databaseLocation() };
  });

  handle(DATABASE_CHANNELS.resetLocation, args(), (): DatabaseLocation => {
    writeLocationPointer(app.getPath('userData'), null);
    return databaseLocation();
  });

  // Like the folder, only the pointer changes: the file already open is not renamed.
  handle(
    DATABASE_CHANNELS.setFileName,
    args((value) => expectNullableString(value, 'fileName')),
    (_event, fileName): DatabaseLocationResult => {
      if (fileName === null) {
        writeFileNamePointer(app.getPath('userData'), null);
        return { status: 'changed', location: databaseLocation() };
      }
      const normalized = normalizeDatabaseFileName(fileName);
      if ('error' in normalized) {
        return { status: 'error', message: normalized.error };
      }
      writeFileNamePointer(app.getPath('userData'), normalized.fileName);
      return { status: 'changed', location: databaseLocation() };
    },
  );

  handle(DATABASE_CHANNELS.relaunch, args(), () => {
    app.relaunch();
    // `quit` (not `exit`) so main.ts's `will-quit` still closes the database cleanly.
    app.quit();
  });
}
