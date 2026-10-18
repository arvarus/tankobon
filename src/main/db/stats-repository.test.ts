import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { LibraryRepository } from './library-repository';
import { migrate } from './schema';
import { localDay, StatsRepository } from './stats-repository';

describe('StatsRepository', () => {
  let db: DatabaseSync;
  let library: LibraryRepository;
  let stats: StatsRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    migrate(db);
    library = new LibraryRepository(db);
    stats = new StatsRepository(db);
  });

  it('is empty on a new database', () => {
    expect(stats.get()).toEqual({ finished: [], days: [] });
  });

  it('adds up the reading time of a day, all books together', () => {
    stats.addReadingTime('a', 60, new Date(2026, 9, 2, 8));
    stats.addReadingTime('b', 30, new Date(2026, 9, 2, 22));
    stats.addReadingTime('a', 45, new Date(2026, 9, 3, 9));
    expect(stats.get().days).toEqual([
      { day: '2026-10-02', seconds: 90 },
      { day: '2026-10-03', seconds: 45 },
    ]);
  });

  it('records a book as finished once, when its last page is reached', () => {
    const { id } = library.touch('/a.cbz', 'A', 10, 10, 100);
    library.updateProgress(id, 4);
    expect(stats.get().finished).toEqual([]);

    library.updateProgress(id, 9);
    const [first] = stats.get().finished;
    expect(first).toBeDefined();

    library.updateProgress(id, 3);
    library.updateProgress(id, 9);
    expect(stats.get().finished).toEqual([first]);
  });

  it('records a book tagged Lu as finished, but not one with other tags', () => {
    const a = library.touch('/a.cbz', 'A', 10, 10, 100);
    const b = library.touch('/b.cbz', 'B', 10, 10, 100);
    library.updateTags(a.id, ['À lire']);
    library.updateTags(b.id, ['Lu']);
    expect(stats.get().finished).toHaveLength(1);
  });

  it('empties the history when the library is cleared', () => {
    const { id } = library.touch('/a.cbz', 'A', 10, 10, 100);
    library.updateProgress(id, 9);
    stats.addReadingTime(id, 60);
    library.clear();
    expect(stats.get()).toEqual({ finished: [], days: [] });
  });
});

describe('StatsRepository history', () => {
  let db: DatabaseSync;
  let library: LibraryRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    migrate(db);
    library = new LibraryRepository(db);
  });

  it('lists the time per day and book, most recent first, and keeps removed books', () => {
    const stats = new StatsRepository(db);
    const a = library.touch('/a.cbz', 'A', 10, 10, 100);
    const b = library.touch('/b.cbz', 'B', 10, 10, 100);
    stats.addReadingTime(a.id, 60, new Date(2026, 9, 2, 8));
    stats.addReadingTime(a.id, 30, new Date(2026, 9, 2, 9));
    stats.addReadingTime(b.id, 20, new Date(2026, 9, 3, 9));
    library.remove(a.id);
    expect(stats.history()).toEqual([
      { day: '2026-10-03', libraryId: b.id, title: 'B', seconds: 20 },
      { day: '2026-10-02', libraryId: a.id, title: null, seconds: 90 },
    ]);
    expect(stats.history(1)).toHaveLength(1);
  });

  it('clears only the active user\'s history, keeping progress and finished dates', () => {
    let active = 'default';
    const stats = new StatsRepository(db, () => active);
    const { id } = library.touch('/a.cbz', 'A', 10, 10, 100);
    library.updateProgress(id, 9);
    stats.addReadingTime(id, 60);
    active = 'other';
    stats.addReadingTime(id, 45);
    stats.clearHistory();
    expect(stats.history()).toEqual([]);
    active = 'default';
    expect(stats.history()).toHaveLength(1);
    stats.clearHistory();
    expect(stats.history()).toEqual([]);
    expect(stats.get().finished).toHaveLength(1);
  });
});

describe('localDay', () => {
  it('formats the local date with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
