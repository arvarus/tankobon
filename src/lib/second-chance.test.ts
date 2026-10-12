import { describe, expect, it } from 'vitest';

import { lowestRated } from './second-chance';
import type { LibraryEntry } from '@/shared/library';

const entry = (id: string, rating: number, title = id): LibraryEntry =>
  ({ id, rating, title }) as unknown as LibraryEntry;

describe('lowestRated', () => {
  it('keeps only poorly rated books, ignoring unrated and well rated ones', () => {
    const result = lowestRated([entry('a', 0), entry('b', 1), entry('c', 3), entry('d', 2), entry('e', 5)]);
    expect(result.map((e) => e.id)).toEqual(['b', 'd']);
  });

  it('sorts worst first, then by title with numbers in natural order', () => {
    const result = lowestRated([entry('1', 2, 'T10'), entry('2', 2, 'T2'), entry('3', 1, 'Z')]);
    expect(result.map((e) => e.id)).toEqual(['3', '2', '1']);
  });

  it('cuts to the limit without mutating the input', () => {
    const input = [entry('a', 2), entry('b', 1), entry('c', 1)];
    expect(lowestRated(input, 2).map((e) => e.id)).toEqual(['b', 'c']);
    expect(input.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});
