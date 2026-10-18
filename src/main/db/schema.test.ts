import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { BUSY_TIMEOUT_MS, configureConnection, migrate } from './schema';

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

describe('migrate', () => {
  it('creates the full schema on an empty database', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);

    expect(columnNames(db, 'library')).toEqual([
      'id',
      'path',
      'title',
      'page_count',
      'current_page',
      'added_at',
      'last_opened_at',
      'file_count',
      'file_size',
      'rating',
      'tags',
      'title_locked',
      'series',
      'volume',
      'release_date',
      'language',
      'avg_page_width',
      'avg_page_height',
      'finished_at',
    ]);
    expect(columnNames(db, 'reading_sessions')).toEqual(['id', 'library_id', 'day', 'seconds', 'user_id']);
    expect(columnNames(db, 'settings')).toEqual(['key', 'value']);
    expect(columnNames(db, 'people')).toEqual(['id', 'first_name', 'last_name', 'nationality']);
    expect(columnNames(db, 'credits')).toEqual(['library_id', 'person_id', 'role', 'position']);
    expect(columnNames(db, 'reading_lists')).toEqual(['id', 'name', 'created_at', 'position', 'user_id']);
    expect(columnNames(db, 'reading_list_items')).toEqual(['list_id', 'library_id', 'position']);
    expect(columnNames(db, 'library_folders')).toEqual(['path', 'added_at']);
    expect(columnNames(db, 'users')).toEqual(['id', 'nickname', 'avatar', 'avatar_type', 'created_at', 'last_active_at']);
    expect(columnNames(db, 'user_books')).toEqual([
      'user_id',
      'library_id',
      'current_page',
      'rating',
      'tags',
      'finished_at',
      'last_opened_at',
    ]);
    expect(columnNames(db, 'user_settings')).toEqual(['user_id', 'key', 'value']);
    expect(columnNames(db, 'user_achievements')).toEqual(['user_id', 'id', 'unlocked_at']);
  });

  it('backfills the later columns on a database from the initial release, keeping its rows', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE library (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        current_page INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL
      );
      INSERT INTO library VALUES ('a', '/comics/a.cbz', 'A', 20, 5, '2024-01-01', '2024-01-02');
    `);

    migrate(db);

    expect(
      db.prepare('SELECT current_page, file_count, file_size, rating, tags, title_locked, series FROM library').get(),
    ).toEqual({
      current_page: 5,
      file_count: 0,
      file_size: 0,
      rating: 0,
      tags: '[]',
      title_locked: 0,
      series: null,
    });
    expect(columnNames(db, 'settings')).toEqual(['key', 'value']);
  });

  it('is idempotent', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec("INSERT INTO settings VALUES ('theme', '\"dark\"')");

    expect(() => migrate(db)).not.toThrow();
    expect(columnNames(db, 'library')).toHaveLength(19);
    expect(db.prepare('SELECT value FROM settings').get()).toEqual({ value: '"dark"' });
  });
});

const INDEXES = [
  'idx_credits_person_id',
  'idx_reading_lists_user_id',
  'idx_reading_sessions_day',
  'idx_reading_sessions_user_day',
  'idx_user_books_library_id',
];

describe('versioned migrations', () => {
  const userVersion = (db: DatabaseSync) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  const indexNames = (db: DatabaseSync) =>
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all() as { name: string }[]).map(
      (i) => i.name,
    ).sort();

  it('stamps a fresh database with the latest version and its indexes', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);

    expect(userVersion(db)).toBe(7);
    expect(indexNames(db)).toEqual(INDEXES);
  });

  it('upgrades an installed, unversioned database without touching its rows', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec("INSERT INTO settings VALUES ('theme', '\"dark\"')");
    db.exec('DROP INDEX idx_credits_person_id; DROP INDEX idx_reading_sessions_day; PRAGMA user_version = 0');

    migrate(db);

    expect(userVersion(db)).toBe(7);
    expect(indexNames(db)).toEqual(INDEXES);
    expect(db.prepare('SELECT value FROM settings').get()).toEqual({ value: '"dark"' });
  });

  it('adds the statistics columns to a database already at version 4', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec('DROP TABLE reading_sessions; ALTER TABLE library DROP COLUMN finished_at; PRAGMA user_version = 4');

    migrate(db);

    expect(userVersion(db)).toBe(7);
    expect(columnNames(db, 'library')).toContain('finished_at');
    expect(columnNames(db, 'reading_sessions')).toEqual(['id', 'library_id', 'day', 'seconds', 'user_id']);
  });

  it('adds the achievements table to a database already at version 5', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec('DROP TABLE achievements; PRAGMA user_version = 5');

    migrate(db);

    expect(userVersion(db)).toBe(7);
    expect(columnNames(db, 'achievements')).toEqual(['id', 'unlocked_at']);
  });

  it('hands everything personal to a first user when the users arrive (version 7)', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    // Rewind to a version-6 database holding data, then migrate again.
    db.exec(`
      DROP TABLE users; DROP TABLE user_books; DROP TABLE user_settings; DROP TABLE user_achievements;
      INSERT INTO library (id, path, title, page_count, current_page, added_at, last_opened_at, rating, tags, finished_at)
        VALUES ('a', '/a.cbz', 'A', 10, 4, '2024-01-01', '2024-02-01', 3, '["Lu"]', '2024-03-01');
      INSERT INTO settings VALUES ('readingMode', '"continuous"'), ('resyncOnStartup', 'true');
      INSERT INTO achievements VALUES ('nightOwl', '2024-04-01');
      INSERT INTO reading_lists (id, name, created_at) VALUES ('l', 'List', '2024-01-01');
      INSERT INTO reading_sessions (library_id, day, seconds) VALUES ('a', '2024-03-01', 60);
      PRAGMA user_version = 6;
    `);

    migrate(db);

    const users = db.prepare('SELECT id, nickname FROM users').all() as { id: string; nickname: string }[];
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('default');
    expect(users[0].nickname).not.toBe('');
    expect(db.prepare('SELECT * FROM user_books').all()).toEqual([
      {
        user_id: 'default',
        library_id: 'a',
        current_page: 4,
        rating: 3,
        tags: '["Lu"]',
        finished_at: '2024-03-01',
        last_opened_at: '2024-02-01',
      },
    ]);
    expect(db.prepare('SELECT user_id, key FROM user_settings ORDER BY key').all()).toEqual([
      { user_id: 'default', key: 'readingMode' },
      { user_id: 'default', key: 'resyncOnStartup' },
    ]);
    expect(db.prepare('SELECT user_id, id FROM user_achievements').all()).toEqual([{ user_id: 'default', id: 'nightOwl' }]);
    expect(db.prepare('SELECT user_id FROM reading_lists').get()).toEqual({ user_id: 'default' });
    expect(db.prepare('SELECT user_id FROM reading_sessions').get()).toEqual({ user_id: 'default' });
  });

  it('leaves a database from a newer release alone', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA user_version = 99');

    migrate(db);

    expect(userVersion(db)).toBe(99);
    expect(columnNames(db, 'library')).toEqual([]);
  });
});

describe('configureConnection', () => {
  it('makes the connection wait for a lock held elsewhere instead of failing at once', () => {
    const db = new DatabaseSync(':memory:');
    expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 0 });

    configureConnection(db);

    expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: BUSY_TIMEOUT_MS });
  });
});
