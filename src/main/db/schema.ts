/**
 * The SQLite schema as an ordered list of versioned migrations. Kept apart from database.ts, which imports
 * `electron`, so that the repository tests can build their `:memory:` databases with the very
 * same `migrate()` the app runs at startup instead of a hand-maintained copy of the tables.
 * @module
 */
import { userInfo } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';

import { withTransaction } from './transaction';

/** The user migration 7 creates and hands the existing data to; the same value as `DEFAULT_USER_ID`, frozen here. */
const FIRST_USER_ID = 'default';

/** One step of the schema's history, applied at most once per database. */
interface Migration {
  /** Strictly increasing, starting at 1, without gaps: stored in `PRAGMA user_version` once applied. */
  version: number;
  run: (db: DatabaseSync) => void;
}

/**
 * The schema's history, in order. Never edit or reorder a migration that has shipped: add a new one
 * at the end (a table, an index, a data fix, a column through `addColumnIfMissing()`).
 */
const MIGRATIONS: Migration[] = [
  {
    // Everything that existed before versioning. Idempotent (`IF NOT EXISTS`, `addColumnIfMissing()`),
    // so it is safe both on a fresh database and on an installed one still at `user_version` 0.
    version: 1,
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS library (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          page_count INTEGER NOT NULL,
          current_page INTEGER NOT NULL DEFAULT 0,
          added_at TEXT NOT NULL,
          last_opened_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS people (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL COLLATE NOCASE DEFAULT '',
          last_name TEXT NOT NULL COLLATE NOCASE,
          nationality TEXT,
          UNIQUE (first_name, last_name)
        );

        CREATE TABLE IF NOT EXISTS credits (
          library_id TEXT NOT NULL REFERENCES library (id) ON DELETE CASCADE,
          person_id TEXT NOT NULL REFERENCES people (id),
          role TEXT NOT NULL,
          position INTEGER NOT NULL,
          PRIMARY KEY (library_id, person_id, role)
        );

        CREATE TABLE IF NOT EXISTS reading_lists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reading_list_items (
          list_id TEXT NOT NULL REFERENCES reading_lists (id) ON DELETE CASCADE,
          library_id TEXT NOT NULL REFERENCES library (id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          PRIMARY KEY (list_id, library_id)
        );
      `);

      // Columns added after the initial release: existing databases need them backfilled.
      addColumnIfMissing(db, 'library', 'file_count', 'INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing(db, 'library', 'file_size', 'INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing(db, 'library', 'rating', 'INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing(db, 'library', 'tags', "TEXT NOT NULL DEFAULT '[]'");
      addColumnIfMissing(db, 'library', 'title_locked', 'INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing(db, 'library', 'series', 'TEXT');
      addColumnIfMissing(db, 'library', 'volume', 'TEXT');
      addColumnIfMissing(db, 'library', 'release_date', 'TEXT');
      addColumnIfMissing(db, 'library', 'language', 'TEXT');
      // Existing lists all get 0: `list()` then falls back to their creation order, as before.
      addColumnIfMissing(db, 'reading_lists', 'position', 'INTEGER NOT NULL DEFAULT 0');
    },
  },
  {
    // The author page will list a person's credits: without it, that is a scan of the whole table.
    version: 2,
    run: (db) => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_credits_person_id ON credits (person_id)');
    },
  },
  {
    // The folders the user added to the library, which "Resynchronize" walks again.
    version: 3,
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS library_folders (
          path TEXT PRIMARY KEY,
          added_at TEXT NOT NULL
        )
      `);
    },
  },
  {
    // Average size of a book's page images, filled in by the background scan (NULL until measured).
    version: 4,
    run: (db) => {
      addColumnIfMissing(db, 'library', 'avg_page_width', 'INTEGER');
      addColumnIfMissing(db, 'library', 'avg_page_height', 'INTEGER');
    },
  },
  {
    // Reading statistics: when a book was finished, and the time spent reading, kept as history
    // (nothing is derived for the books read before this version).
    version: 5,
    run: (db) => {
      addColumnIfMissing(db, 'library', 'finished_at', 'TEXT');
      db.exec(`
        CREATE TABLE IF NOT EXISTS reading_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          library_id TEXT NOT NULL,
          day TEXT NOT NULL,
          seconds INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reading_sessions_day ON reading_sessions (day);
      `);
    },
  },
  {
    // The achievements the user has earned, with the moment they were.
    version: 6,
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY,
          unlocked_at TEXT NOT NULL
        )
      `);
    },
  },
  {
    // Several users on one library: the books, their metadata and the library's organization stay
    // common; what is personal (rating, tags, progress, reading lists, reading history, achievements,
    // settings) moves to per-user tables or gets a `user_id`. Everything that exists becomes the first
    // user's. The columns of `library` that used to hold the personal values (`current_page`, `rating`,
    // `tags`, `finished_at`) are no longer read (SQLite can't drop them without rebuilding the table).
    version: 7,
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL,
          avatar BLOB,
          avatar_type TEXT,
          created_at TEXT NOT NULL,
          last_active_at TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS user_books (
          user_id TEXT NOT NULL,
          library_id TEXT NOT NULL,
          current_page INTEGER NOT NULL DEFAULT 0,
          rating INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          finished_at TEXT,
          last_opened_at TEXT NOT NULL,
          PRIMARY KEY (user_id, library_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_books_library_id ON user_books (library_id);

        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        );

        CREATE TABLE IF NOT EXISTS user_achievements (
          user_id TEXT NOT NULL,
          id TEXT NOT NULL,
          unlocked_at TEXT NOT NULL,
          PRIMARY KEY (user_id, id)
        );
      `);
      // Frozen like the rest of the migration: the first user's id, whatever `DEFAULT_USER_ID` becomes.
      addColumnIfMissing(db, 'reading_lists', 'user_id', "TEXT NOT NULL DEFAULT 'default'");
      addColumnIfMissing(db, 'reading_sessions', 'user_id', "TEXT NOT NULL DEFAULT 'default'");
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_reading_lists_user_id ON reading_lists (user_id);
        CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_day ON reading_sessions (user_id, day);
      `);

      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO users (id, nickname, created_at, last_active_at) VALUES (?, ?, ?, ?)').run(
        FIRST_USER_ID,
        osNickname(),
        now,
        now,
      );
      db.prepare(
        `INSERT OR IGNORE INTO user_books (user_id, library_id, current_page, rating, tags, finished_at, last_opened_at)
         SELECT ?, id, current_page, rating, tags, finished_at, last_opened_at FROM library`,
      ).run(FIRST_USER_ID);
      // Every stored setting is copied: the ones that stay shared are simply read from `settings` from now on.
      db.prepare('INSERT OR IGNORE INTO user_settings (user_id, key, value) SELECT ?, key, value FROM settings').run(
        FIRST_USER_ID,
      );
      db.prepare(
        'INSERT OR IGNORE INTO user_achievements (user_id, id, unlocked_at) SELECT ?, id, unlocked_at FROM achievements',
      ).run(FIRST_USER_ID);
    },
  },
  {
    // Library folders get an id and stop being keyed by their path, which is a machine's: the books
    // under a folder are stored relative to it (`root:<id>/…`) and each machine says where the folder
    // is (see `PathRoots`). A folder the user forgets stays, unwatched, since books refer to it.
    version: 8,
    run: (db) => {
      db.exec(`
        CREATE TABLE library_folders_v8 (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          added_at TEXT NOT NULL,
          watched INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO library_folders_v8 (id, path, added_at)
          SELECT lower(hex(randomblob(16))), path, added_at FROM library_folders;
        DROP TABLE library_folders;
        ALTER TABLE library_folders_v8 RENAME TO library_folders;
      `);
    },
  },
];

/** The name of the OS session, which makes the first user's nickname; a generic one when it can't be read. */
function osNickname(): string {
  try {
    const name = userInfo().username.trim();
    if (name !== '') return name.slice(0, 40);
  } catch {
    // No such information (a restricted environment): the generic nickname below.
  }
  return 'Utilisateur';
}

/** How long a statement waits for another connection's lock before failing with "database is locked", in milliseconds. */
export const BUSY_TIMEOUT_MS = 5000;

/**
 * Makes `db` wait for a lock held by another connection (a second instance of the app, a sync tool
 * reading the file) instead of failing at once, which is what SQLite does by default.
 */
export function configureConnection(db: DatabaseSync): void {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
}

/**
 * Brings `db` up to the current schema by applying, in order, the migrations newer than its
 * `PRAGMA user_version`. Each runs in its own transaction together with the version bump, so a
 * failure leaves the database at the last fully applied version. Never destructive on its own,
 * and a no-op on an up-to-date database, so it runs on every start.
 *
 * A database whose version is ahead of this build (written by a newer release) is left untouched.
 */
export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (const migration of MIGRATIONS) {
    if (migration.version <= row.user_version) continue;
    withTransaction(db, () => {
      migration.run(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
