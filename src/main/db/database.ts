/**
 * Local, file-based storage: a single SQLite database, by default in the user
 * data directory (never in the cloud, never in Chromium's storage) — see
 * db-location.ts for how the user can point it elsewhere. Uses Node's built-in
 * `node:sqlite` module, so no native module needs to be compiled or shipped
 * alongside Electron.
 * @module
 */
import { DatabaseSync } from 'node:sqlite';
import { app } from 'electron';
import { mkdirSync } from 'node:fs';

import type { DatabaseLocation } from '../../shared/data';
import { applyPendingRestore } from './backup-service';
import { resolveDatabaseLocation } from './db-location';
import { configureConnection, migrate } from './schema';

/** Where the database lives for this run, resolved from Electron's `userData` directory (see db-location.ts). */
export function databaseLocation(): DatabaseLocation {
  return resolveDatabaseLocation(app.getPath('userData'));
}

/** Opens the database at its configured location (creating the directory and file if needed) and migrates its schema. */
export function openDatabase(): DatabaseSync {
  const { directory, filePath } = databaseLocation();
  mkdirSync(directory, { recursive: true });
  // A restoration asked for before the last quit replaces the file now, while nothing has it open.
  applyPendingRestore(app.getPath('userData'), directory, filePath);
  const db = new DatabaseSync(filePath);
  configureConnection(db);
  migrate(db);
  return db;
}
