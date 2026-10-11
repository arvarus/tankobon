import { describe, expect, it } from 'vitest';

import { sortEntries } from './library-sort';
import type { LibraryEntry } from '@/shared/library';

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'id',
    path: 'C:/comics/book.cbz',
    title: 'Book',
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
    avgPageWidth: null,
    avgPageHeight: null,
    credits: [],
    ...overrides,
  };
}

const ids = (entries: LibraryEntry[]) => entries.map((e) => e.id);

describe('sortEntries', () => {
  it('keeps the given order for lastOpened, in a new array', () => {
    const entries = [entry({ id: 'b', title: 'B' }), entry({ id: 'a', title: 'A' })];
    const sorted = sortEntries(entries, 'lastOpened');
    expect(ids(sorted)).toEqual(['b', 'a']);
    expect(sorted).not.toBe(entries);
  });

  it('sorts by date added both ways, ties by title', () => {
    const entries = [
      entry({ id: 'mid', addedAt: '2026-02-01T00:00:00.000Z' }),
      entry({ id: 'old-b', title: 'B', addedAt: '2025-01-01T00:00:00.000Z' }),
      entry({ id: 'old-a', title: 'A', addedAt: '2025-01-01T00:00:00.000Z' }),
      entry({ id: 'new', addedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(ids(sortEntries(entries, 'addedAsc'))).toEqual(['old-a', 'old-b', 'mid', 'new']);
    expect(ids(sortEntries(entries, 'addedDesc'))).toEqual(['new', 'mid', 'old-a', 'old-b']);
  });

  it('sorts by release date with mixed precision, books without a date last both ways', () => {
    const entries = [
      entry({ id: 'none', releaseDate: null }),
      entry({ id: '2003-05', releaseDate: '2003-05' }),
      entry({ id: '1999', releaseDate: '1999' }),
      entry({ id: '2003', releaseDate: '2003' }),
      entry({ id: '2003-05-12', releaseDate: '2003-05-12' }),
    ];
    expect(ids(sortEntries(entries, 'releaseAsc'))).toEqual(['1999', '2003', '2003-05', '2003-05-12', 'none']);
    expect(ids(sortEntries(entries, 'releaseDesc'))).toEqual(['2003-05-12', '2003-05', '2003', '1999', 'none']);
  });

  it('sorts by title in natural order, ignoring case and accents', () => {
    const entries = [
      entry({ id: 't10', title: 'Tome 10' }),
      entry({ id: 'ecole', title: 'école' }),
      entry({ id: 't2', title: 'Tome 2' }),
      entry({ id: 'zebre', title: 'Zèbre' }),
    ];
    expect(ids(sortEntries(entries, 'titleAsc'))).toEqual(['ecole', 't2', 't10', 'zebre']);
    expect(ids(sortEntries(entries, 'titleDesc'))).toEqual(['zebre', 't10', 't2', 'ecole']);
  });
});
