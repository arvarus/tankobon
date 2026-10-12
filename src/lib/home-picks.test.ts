import { describe, expect, it } from 'vitest';

import { pickRandomUnread } from '@/lib/home-picks';
import type { LibraryEntry } from '@/shared/library';

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id, tags: [], pageCount: 10, currentPage: 0, ...overrides } as LibraryEntry;
}

describe('pickRandomUnread', () => {
  it('skips finished books, by last page or by the Lu tag', () => {
    const library = [entry('a'), entry('b', { currentPage: 9 }), entry('c', { tags: ['Lu'] }), entry('d')];
    const ids = pickRandomUnread(library, 5).map((e) => e.id).sort();
    expect(ids).toEqual(['a', 'd']);
  });

  it('returns at most the requested count, without duplicates', () => {
    const library = Array.from({ length: 20 }, (_, i) => entry(String(i)));
    const picks = pickRandomUnread(library, 5);
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((e) => e.id)).size).toBe(5);
  });

  it('is deterministic for a given random source and leaves the library untouched', () => {
    const library = ['a', 'b', 'c', 'd'].map((id) => entry(id));
    expect(pickRandomUnread(library, 2, () => 0).map((e) => e.id)).toEqual(['a', 'b']);
    expect(pickRandomUnread(library, 2, () => 0.99).map((e) => e.id)).toEqual(['d', 'a']);
    expect(library.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns nothing for an empty or fully read library', () => {
    expect(pickRandomUnread([], 5)).toEqual([]);
    expect(pickRandomUnread([entry('a', { tags: ['Lu'] })], 5)).toEqual([]);
  });
});
