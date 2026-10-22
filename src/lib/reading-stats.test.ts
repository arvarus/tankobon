import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyLanguage } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';
import type { ReadingStats } from '@/shared/stats';

import { buildBuckets, buildLibraryGrowth, formatDuration, libraryTotals, MONTHS_SHOWN, periodKey, periodLabel, totalSeconds } from './reading-stats';

const NOW = new Date(2026, 9, 5, 12); // 5 October 2026, local time

function entry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: 'a',
    path: '/a.cbz',
    title: 'A',
    pageCount: 10,
    currentPage: 0,
    addedAt: '2026-01-01T00:00:00.000Z',
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
    fileCount: 10,
    fileSize: 1000,
    rating: 0,
    tags: [],
    titleLocked: false,
    series: null,
    volume: null,
    releaseDate: null,
    language: null,
    credits: [],
    avgPageWidth: null,
    avgPageHeight: null,
    ...overrides,
  };
}

describe('libraryTotals', () => {
  it('counts the books, the read ones (last page or Lu tag) and their size', () => {
    const totals = libraryTotals([
      entry({ fileSize: 100 }),
      entry({ fileSize: 200, currentPage: 9 }),
      entry({ fileSize: 300, tags: ['Lu'] }),
    ]);
    expect(totals).toEqual({ books: 3, read: 2, bytes: 600 });
  });

  it('is all zeros for an empty library', () => {
    expect(libraryTotals([])).toEqual({ books: 0, read: 0, bytes: 0 });
  });
});

describe('periodKey', () => {
  it('uses the local month and year', () => {
    expect(periodKey(new Date(2026, 0, 31, 23, 59), 'month')).toBe('2026-01');
    expect(periodKey(new Date(2026, 0, 31, 23, 59), 'year')).toBe('2026');
  });
});

describe('buildBuckets', () => {
  const stats: ReadingStats = {
    finished: [new Date(2026, 9, 1).toISOString(), new Date(2026, 9, 3).toISOString(), new Date(2026, 7, 10).toISOString()],
    days: [
      { day: '2026-10-02', seconds: 600 },
      { day: '2026-10-04', seconds: 300 },
      { day: '2026-08-15', seconds: 1200 },
    ],
  };

  it('shows the last twelve months, empty ones included, oldest first', () => {
    const buckets = buildBuckets(stats, 'month', NOW);
    expect(buckets).toHaveLength(MONTHS_SHOWN);
    expect(buckets[0].key).toBe('2025-11');
    expect(buckets[11].key).toBe('2026-10');
    expect(buckets[11]).toEqual({ key: '2026-10', booksRead: 2, seconds: 900 });
    expect(buckets[9]).toEqual({ key: '2026-08', booksRead: 1, seconds: 1200 });
    expect(buckets[10]).toEqual({ key: '2026-09', booksRead: 0, seconds: 0 });
  });

  it('drops what is older than the months shown', () => {
    const old: ReadingStats = { finished: [new Date(2020, 0, 5).toISOString()], days: [{ day: '2020-01-05', seconds: 60 }] };
    expect(buildBuckets(old, 'month', NOW).every((bucket) => bucket.booksRead === 0 && bucket.seconds === 0)).toBe(true);
  });

  it('groups by year from the first year with data, up to the current one', () => {
    const yearly: ReadingStats = {
      finished: [new Date(2024, 5, 1).toISOString(), new Date(2026, 1, 1).toISOString()],
      days: [{ day: '2025-03-01', seconds: 120 }],
    };
    expect(buildBuckets(yearly, 'year', NOW)).toEqual([
      { key: '2024', booksRead: 1, seconds: 0 },
      { key: '2025', booksRead: 0, seconds: 120 },
      { key: '2026', booksRead: 1, seconds: 0 },
    ]);
  });

  it('shows the current year alone when there is no history', () => {
    expect(buildBuckets({ finished: [], days: [] }, 'year', NOW)).toEqual([{ key: '2026', booksRead: 0, seconds: 0 }]);
  });
});

describe('totalSeconds', () => {
  it('sums every day', () => {
    expect(totalSeconds({ finished: [], days: [{ day: '2026-01-01', seconds: 60 }, { day: '2026-01-02', seconds: 90 }] })).toBe(150);
  });
});

describe('formatting', () => {
  beforeAll(() => applyLanguage('en'));
  afterAll(() => applyLanguage('en'));

  it('formats durations to the minute', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(3 * 3600)).toBe('3 h');
    expect(formatDuration(3 * 3600 + 20 * 60 + 20)).toBe('3 h 20 min');
  });

  it('labels a year as is and a month in the current language', () => {
    expect(periodLabel('2026')).toBe('2026');
    expect(periodLabel('2026-10')).toMatch(/Oct/);
    applyLanguage('fr');
    expect(periodLabel('2026-10')).toMatch(/oct/);
    expect(formatDuration(3 * 3600 + 20 * 60)).toBe('3 h 20 min');
  });
});

describe('buildLibraryGrowth', () => {
  const entries = [
    entry({ addedAt: new Date(2025, 5, 10).toISOString() }),
    entry({ addedAt: new Date(2026, 8, 20).toISOString() }),
    entry({ addedAt: new Date(2026, 9, 1).toISOString() }),
  ];

  it('accumulates the books by month, keeping the earlier ones in the first slot', () => {
    const points = buildLibraryGrowth(entries, 'month', NOW);
    expect(points).toHaveLength(MONTHS_SHOWN);
    expect(points[0]).toEqual({ key: '2025-11', books: 1 });
    expect(points.at(-2)).toEqual({ key: '2026-09', books: 2 });
    expect(points.at(-1)).toEqual({ key: '2026-10', books: 3 });
  });

  it('accumulates by year since the first book', () => {
    expect(buildLibraryGrowth(entries, 'year', NOW)).toEqual([
      { key: '2025', books: 1 },
      { key: '2026', books: 3 },
    ]);
  });

  it('gives zeros for an empty library', () => {
    expect(buildLibraryGrowth([], 'year', NOW)).toEqual([{ key: '2026', books: 0 }]);
  });
});
