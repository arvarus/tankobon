import { describe, expect, it } from 'vitest';

import { recentlyAdded } from './recent-books';
import type { LibraryEntry } from '@/shared/library';

function entry(id: string, addedAt: string): LibraryEntry {
  return {
    id,
    path: `C:/comics/${id}.cbz`,
    title: id,
    pageCount: 10,
    currentPage: 0,
    addedAt,
    lastOpenedAt: addedAt,
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
  };
}

const ids = (entries: LibraryEntry[]) => entries.map((e) => e.id);

describe('recentlyAdded', () => {
  it('returns the newest additions first, whatever the given order', () => {
    const entries = [entry('a', '2026-01-01'), entry('c', '2026-03-01'), entry('b', '2026-02-01')];
    expect(ids(recentlyAdded(entries))).toEqual(['c', 'b', 'a']);
  });

  it('keeps only the requested count, 5 by default', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(`e${i}`, `2026-01-0${i + 1}`));
    expect(ids(recentlyAdded(entries))).toEqual(['e7', 'e6', 'e5', 'e4', 'e3']);
    expect(ids(recentlyAdded(entries, 2))).toEqual(['e7', 'e6']);
  });

  it('keeps the given order for equal dates and does not mutate its input', () => {
    const entries = [entry('x', '2026-01-01'), entry('y', '2026-01-01')];
    expect(ids(recentlyAdded(entries))).toEqual(['x', 'y']);
    expect(ids(entries)).toEqual(['x', 'y']);
  });

  it('returns an empty list for an empty library', () => {
    expect(recentlyAdded([])).toEqual([]);
  });
});
