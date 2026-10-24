import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../../shared/settings';
import { AchievementRepository } from './achievement-repository';
import { LibraryRepository } from './library-repository';
import { ReadingListRepository } from './reading-list-repository';
import { migrate } from './schema';
import { SettingsRepository } from './settings-repository';
import { StatsRepository } from './stats-repository';
import { UserRepository } from './user-repository';

// Two users on one database: what is personal is told apart, what belongs to the library is common.
let current = 'alice';
const user = () => current;
const as = (id: string) => {
  current = id;
};

let db: DatabaseSync;
let library: LibraryRepository;
let lists: ReadingListRepository;
let settings: SettingsRepository;
let stats: StatsRepository;
let achievements: AchievementRepository;

beforeEach(() => {
  current = 'alice';
  db = new DatabaseSync(':memory:');
  migrate(db);
  library = new LibraryRepository(db, user);
  lists = new ReadingListRepository(db, user);
  settings = new SettingsRepository(db, user);
  stats = new StatsRepository(db, user);
  achievements = new AchievementRepository(db, user);
});

describe('library, per user', () => {
  it('keeps rating, tags, progress and the last opening apart, and metadata in common', () => {
    const entry = library.touch('/a.cbz', 'A', 20, 20, 100);
    library.updateRating(entry.id, 5);
    library.updateTags(entry.id, ['Lu']);
    library.updateProgress(entry.id, 7);
    library.updateMetadata(entry.id, { series: 'Série' });

    as('bob');
    const seenByBob = library.get(entry.id);
    expect(seenByBob).toMatchObject({ rating: 0, tags: [], currentPage: 0, series: 'Série' });
    // A book Bob never opened counts as last opened when it was added.
    expect(seenByBob?.lastOpenedAt).toBe(entry.addedAt);

    library.updateRating(entry.id, 2);
    library.updateProgress(entry.id, 3);
    expect(library.get(entry.id)).toMatchObject({ rating: 2, currentPage: 3, tags: [] });

    as('alice');
    expect(library.get(entry.id)).toMatchObject({ rating: 5, currentPage: 7, tags: ['Lu'] });
  });

  it('lists every book for every user, each with their own state', () => {
    const a = library.touch('/a.cbz', 'A', 10, 10, 1);
    library.register('/b.cbz', 'B', 10, 10, 1);
    library.updateRating(a.id, 4);

    as('bob');
    expect(library.list().map((entry) => [entry.title, entry.rating]).sort()).toEqual([
      ['A', 0],
      ['B', 0],
    ]);
  });

  it('opening a book bumps only the opener’s last opening', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
      const a = library.touch('/a.cbz', 'A', 10, 10, 1);
      vi.setSystemTime(new Date('2026-01-02T10:00:00Z'));
      library.register('/b.cbz', 'B', 10, 10, 1);
      const b = library.list().find((entry) => entry.title === 'B')!;
      expect(library.list()[0].id).toBe(b.id); // Alice: the scanned book is the newest.

      vi.setSystemTime(new Date('2026-01-03T10:00:00Z'));
      as('bob');
      library.touch('/a.cbz', 'A', 10, 10, 1);
      expect(library.list()[0].id).toBe(a.id);

      as('alice');
      expect(library.list()[0].id).toBe(b.id);
      expect(library.get(a.id)?.lastOpenedAt).toBe('2026-01-01T10:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dates a user’s first completion separately', () => {
    const entry = library.touch('/a.cbz', 'A', 5, 5, 1);
    library.updateProgress(entry.id, 4);
    as('bob');
    expect(stats.get().finished).toEqual([]);
    as('alice');
    expect(stats.get().finished).toHaveLength(1);
  });

  it('removing a book removes everyone’s state for it', () => {
    const entry = library.touch('/a.cbz', 'A', 5, 5, 1);
    as('bob');
    library.updateRating(entry.id, 3);
    library.remove(entry.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM user_books').get()).toEqual({ n: 0 });
  });
});

describe('reading lists, per user', () => {
  it('gives each user their own lists, which the other can’t touch', () => {
    const entry = library.touch('/a.cbz', 'A', 5, 5, 1);
    const created = lists.create('Mes BD');
    if (created.status !== 'ok') throw new Error('not created');
    lists.addEntry(created.list.id, entry.id);

    as('bob');
    expect(lists.list()).toEqual([]);
    expect(lists.get(created.list.id)).toBeNull();
    expect(lists.rename(created.list.id, 'Volé').status).toBe('error');
    expect(lists.addEntry(created.list.id, entry.id).status).toBe('error');
    lists.remove(created.list.id);
    lists.create('Les miennes');

    as('alice');
    expect(lists.list().map((list) => [list.name, list.entryIds.length])).toEqual([['Mes BD', 1]]);
  });

  it('numbers each user’s lists on their own and clears only theirs', () => {
    lists.create('A1');
    as('bob');
    lists.create('B1');
    lists.create('B2');
    expect(lists.list().map((list) => list.name)).toEqual(['B1', 'B2']);
    expect(lists.clear()).toBe(2);
    as('alice');
    expect(lists.list().map((list) => list.name)).toEqual(['A1']);
  });

  it('flags a list owned by someone else, so an import can give it a new id', () => {
    const created = lists.create('A1');
    if (created.status !== 'ok') throw new Error('not created');
    expect(lists.isForeign(created.list.id)).toBe(false);
    as('bob');
    expect(lists.isForeign(created.list.id)).toBe(true);
  });
});

describe('settings, per user', () => {
  it('stores personal settings per user and falls back to the defaults', () => {
    settings.set('readingMode', 'continuous');
    as('bob');
    expect(settings.getAll().readingMode).toBe(DEFAULT_SETTINGS.readingMode);
    settings.set('readingMode', 'single');
    settings.set('language', 'fr');
    as('alice');
    expect(settings.getAll()).toEqual({ ...DEFAULT_SETTINGS, readingMode: 'continuous' });
  });

  it('shares the library’s settings between users', () => {
    settings.set('libraryOrganization', 'always');
    as('bob');
    expect(settings.getAll()).toMatchObject({ libraryOrganization: 'always' });
  });

  it('keeps the metadata sources and API keys apart', () => {
    settings.set('comicVineApiKey', 'secret');
    as('bob');
    expect(settings.getAll().comicVineApiKey).toBe(DEFAULT_SETTINGS.comicVineApiKey);
    as('alice');
    expect(settings.getAll().comicVineApiKey).toBe('secret');
  });

  it('ignores a value stored on the wrong side', () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('readingMode', '\"continuous\"')").run();
    db.prepare("INSERT INTO user_settings (user_id, key, value) VALUES ('alice', 'libraryOrganization', '\"always\"')").run();
    expect(settings.getAll()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('statistics and achievements, per user', () => {
  it('keeps the reading time apart', () => {
    stats.addReadingTime('x', 60, new Date(2026, 0, 5));
    as('bob');
    stats.addReadingTime('x', 30, new Date(2026, 0, 5));
    expect(stats.get().days).toEqual([{ day: '2026-01-05', seconds: 30 }]);
    as('alice');
    expect(stats.get().days).toEqual([{ day: '2026-01-05', seconds: 60 }]);
  });

  it('lets each user earn an achievement once, on their own', () => {
    expect(achievements.unlock(['nightOwl'])).toHaveLength(1);
    expect(achievements.unlock(['nightOwl'])).toHaveLength(0);
    as('bob');
    expect(achievements.list()).toEqual([]);
    expect(achievements.unlock(['nightOwl'])).toHaveLength(1);
  });
});

describe('deleting a user', () => {
  it('deletes their personal data and leaves the library and the others alone', () => {
    const users = new UserRepository(db);
    const bobCreated = users.create('Bob');
    if (bobCreated.status !== 'ok') throw new Error('create failed');
    const bob = bobCreated.user.id;
    current = bob;
    const entry = library.touch('/a.cbz', 'A', 20, 20, 100);
    library.updateRating(entry.id, 4);
    const list = lists.create('Mine');
    if (list.status !== 'ok') throw new Error('create failed');
    lists.addEntry(list.list.id, entry.id);
    stats.addReadingTime(entry.id, 30, new Date(2026, 0, 5));
    achievements.unlock(['nightOwl']);
    settings.set('readingMode', 'continuous');

    expect(users.remove(bob)).toMatchObject({ status: 'ok' });

    for (const table of ['user_books', 'reading_lists', 'reading_sessions', 'user_achievements', 'user_settings']) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(bob)).toEqual({ n: 0 });
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM reading_list_items').get()).toEqual({ n: 0 });
    as('alice');
    expect(library.list()).toHaveLength(1);
  });
});
