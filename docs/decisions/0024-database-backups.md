# 0024. Database backups in a `.tankobon` folder, restored at start-up

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The whole library, with every user's progress, ratings and lists, lives in one SQLite file. Users want automatic copies and a way to come back to one, from the app.

## Decision

- **Copies beside the database**: `VACUUM INTO` writes a consistent copy of the open database (safe while it is in use) to `<database folder>/.tankobon/tankobon-AAAAMMJJ-HHMMSS.db`, aside then renamed. The folder follows the database when its location is changed.
- **Settings**: `backupIntervalDays` (0 = off, 1 to 31), `backupKeep` (1 to 50) and `lastBackupAt` are shared settings, since the database is common to every user; `lastBackupAt` is written by the main process only. A copy is made at start-up and then checked every hour while the app stays open; after each one, the oldest copies beyond `backupKeep` are deleted. "Sauvegarder maintenant" makes one on demand.
- **Restoring overwrites the file at the next start**: overwriting a database in use isn't safe, so `database:restore-backup` only writes a `pending-restore.json` pointer in `userData` (the renderer names a backup by its generated file name, never a path, checked against `isBackupName()`); `openDatabase()` applies it before opening the connection, keeping the replaced file as `tankobon.db.before-restore`. The pending request is removed even if the copy can't be applied. The page says the restoration overwrites the file, asks for confirmation, then restarts the app; a pending restoration can be cancelled.

## Consequences

- A restoration loses everything done since the copy; the confirmation says so.
- Copies are full copies: a large library costs `backupKeep` times its size.
- The copies are not exported and not pruned by anything else.
