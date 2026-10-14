import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../../shared/settings';
import { migrate } from './schema';
import { SettingsRepository } from './settings-repository';

let db: DatabaseSync;

function createRepository(): SettingsRepository {
  db = new DatabaseSync(':memory:');
  migrate(db);
  return new SettingsRepository(db);
}

describe('SettingsRepository', () => {
  let repo: SettingsRepository;

  beforeEach(() => {
    repo = createRepository();
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(repo.getAll()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists and returns updated values', () => {
    repo.set('readingDirection', 'rtl');
    expect(repo.getAll()).toEqual({ ...DEFAULT_SETTINGS, readingDirection: 'rtl' });
  });

  it('overwrites a value on repeated writes', () => {
    repo.set('readingDirection', 'rtl');
    repo.set('readingDirection', 'ltr');
    expect(repo.getAll().readingDirection).toBe('ltr');
  });

  it('ignores a row that is unreadable, unknown or invalid for its key', () => {
    repo.set('readingDirection', 'rtl');
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insert.run('pageSpacing', '{not json');
    insert.run('readingMode', '"webtoon"');
    insert.run('somethingRemoved', 'true');

    expect(repo.getAll()).toEqual({ ...DEFAULT_SETTINGS, readingDirection: 'rtl' });
  });
});
