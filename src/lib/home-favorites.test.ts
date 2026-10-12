import { describe, expect, it } from 'vitest';

import { topRated } from './home-favorites';
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

describe('topRated', () => {
  it('ignores unrated books', () => {
    expect(topRated([entry({ id: 'a', rating: 0 })])).toEqual([]);
  });

  it('orders by rating, highest first, and keeps the requested count', () => {
    const entries = [
      entry({ id: 'a', rating: 3 }),
      entry({ id: 'b', rating: 5 }),
      entry({ id: 'c', rating: 4 }),
    ];
    expect(topRated(entries, 2).map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('puts the book opened longest ago first among equal ratings', () => {
    const entries = [
      entry({ id: 'recent', rating: 5, lastOpenedAt: '2026-06-01T00:00:00.000Z' }),
      entry({ id: 'old', rating: 5, lastOpenedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(topRated(entries).map((e) => e.id)).toEqual(['old', 'recent']);
  });

  it('breaks remaining ties on the title and does not mutate its input', () => {
    const entries = [entry({ id: 'b', title: 'B', rating: 4 }), entry({ id: 'a', title: 'A', rating: 4 })];
    expect(topRated(entries).map((e) => e.id)).toEqual(['a', 'b']);
    expect(entries.map((e) => e.id)).toEqual(['b', 'a']);
  });
});
