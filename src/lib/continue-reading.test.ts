import { describe, expect, it } from 'vitest';

import { READ_TAG, type LibraryEntry } from '@/shared/library';

import { continueReading } from './continue-reading';

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    path: `/comics/${id}.cbz`,
    title: id,
    pageCount: 10,
    currentPage: 3,
    addedAt: '2024-01-01',
    lastOpenedAt: '2024-01-01',
    fileCount: 10,
    fileSize: 1,
    rating: 0,
    tags: [],
    ...overrides,
  } as LibraryEntry;
}

describe('continueReading', () => {
  it('keeps started, unfinished books in the given order', () => {
    const library = [entry('a'), entry('b', { currentPage: 0 }), entry('c', { currentPage: 9 }), entry('d', { tags: [READ_TAG] }), entry('e')];
    expect(continueReading(library).map((e) => e.id)).toEqual(['a', 'e']);
  });

  it('is limited to five books', () => {
    const library = Array.from({ length: 8 }, (_, i) => entry(`b${i}`));
    expect(continueReading(library).map((e) => e.id)).toEqual(['b0', 'b1', 'b2', 'b3', 'b4']);
  });
});
