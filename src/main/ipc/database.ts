import { app } from 'electron';

import type { DatabaseSync } from 'node:sqlite';

import type { BackupList, BackupResult, DatabaseLocation, DatabaseLocationResult, RestoreBackupResult } from '../../shared/data';
import { t } from '../../shared/i18n';
import {
  backupDirectory,
  cancelRestore,
  createBackup,
  listBackups,
  pendingRestore,
  pruneBackups,
  scheduleRestore,
} from '../db/backup-service';
import { databaseLocation } from '../db/database';
import type { SettingsRepository } from '../db/settings-repository';
import { checkDirectoryUsable, writeLocationPointer } from '../db/db-location';
import { openDialogFor } from './dialogs';
import type { NotifyDataChange } from './data-changes';
import { handle } from './handle';
import { args, idArg } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const DATABASE_CHANNELS = {
  getLocation: 'database:get-location',
  chooseLocation: 'database:choose-location',
  resetLocation: 'database:reset-location',
  relaunch: 'database:relaunch',
  listBackups: 'database:list-backups',
  createBackup: 'database:create-backup',
  restoreBackup: 'database:restore-backup',
  cancelRestore: 'database:cancel-restore',
} as const;

/**
 * Changing the location only rewrites the pointer file: the database already open stays open, and
 * the new one is picked up on the next start. Moving the existing file is deliberately not done —
 * pointing at a directory that already holds a `tankobon.db` (a synced folder, another machine)
 * has to keep that database rather than overwrite it.
 */
export function registerDatabaseIpc(db: DatabaseSync, settings: SettingsRepository, notify: NotifyDataChange): void {
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

  handle(DATABASE_CHANNELS.relaunch, args(), () => {
    app.relaunch();
    // `quit` (not `exit`) so main.ts's `will-quit` still closes the database cleanly.
    app.quit();
  });

  handle(DATABASE_CHANNELS.listBackups, args(), (): BackupList => {
    const { directory } = databaseLocation();
    return {
      directory: backupDirectory(directory),
      backups: listBackups(directory),
      pendingRestore: pendingRestore(app.getPath('userData')),
    };
  });

  handle(DATABASE_CHANNELS.createBackup, args(), (): BackupResult => runBackup(db, settings, notify));

  handle(DATABASE_CHANNELS.restoreBackup, args(idArg), (_event, name): RestoreBackupResult => {
    const message = scheduleRestore(app.getPath('userData'), databaseLocation().directory, name);
    return message === null ? { status: 'scheduled' } : { status: 'error', message };
  });

  handle(DATABASE_CHANNELS.cancelRestore, args(), () => cancelRestore(app.getPath('userData')));
}

/**
 * Makes a copy of the database now, records the date, then deletes the copies beyond `backupKeep`. A failure
 * (read-only folder, full disk) comes back as an error result, never thrown: the scheduler runs it unattended.
 */
export function runBackup(db: DatabaseSync, settings: SettingsRepository, notify: NotifyDataChange): BackupResult {
  try {
    const { directory } = databaseLocation();
    const backup = createBackup(db, directory);
    const { backupKeep } = settings.getAll();
    pruneBackups(directory, backupKeep);
    settings.set('lastBackupAt', backup.createdAt);
    notify({ scope: 'settings', values: { lastBackupAt: backup.createdAt } });
    return { status: 'created', backup };
  } catch (error) {
    return { status: 'error', message: t('errors:backup.failed', { message: error instanceof Error ? error.message : String(error) }) };
  }
}
