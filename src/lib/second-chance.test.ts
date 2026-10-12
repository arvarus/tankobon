import { describe, expect, it } from 'vitest';

import type { LibraryEntry } from '@/shared/library';

import { secondChanceEntries } from './second-chance';

const entry = (title: string, rating: number): LibraryEntry => ({ id: title, title, rating }) as LibraryEntry;

describe('secondChanceEntries', () => {
  it('keeps only books rated 1 or 2, worst first then by title', () => {
    const result = secondChanceEntries([
      entry('B', 2),
      entry('Tome 10', 1),
      entry('Tome 2', 1),
      entry('Unrated', 0),
      entry('Good', 4),
      entry('A', 2),
    ]);
    expect(result.map((e) => e.title)).toEqual(['Tome 2', 'Tome 10', 'A', 'B']);
  });

  it('cuts the list to the limit and does not mutate its input', () => {
    const input = [entry('C', 1), entry('B', 1), entry('A', 1)];
    expect(secondChanceEntries(input, 2).map((e) => e.title)).toEqual(['A', 'B']);
    expect(input.map((e) => e.title)).toEqual(['C', 'B', 'A']);
  });
});
