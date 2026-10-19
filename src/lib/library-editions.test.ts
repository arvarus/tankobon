import { describe, expect, it } from 'vitest';

import { collapseEditions, editionGroups, editionKey } from './library-editions';
import type { LibraryEntry } from '@/shared/library';

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    path: `/comics/${id}.cbz`,
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

describe('editionKey', () => {
  it('uses series and volume when both are known, ignoring case and accents', () => {
    expect(editionKey(entry('a', { series: 'Pokémon ', volume: '2' }))).toBe(
      editionKey(entry('b', { series: 'pokemon', volume: '2', title: 'Other' })),
    );
  });

  it('falls back to the title when the series or the volume is missing', () => {
    expect(editionKey(entry('a', { title: 'Été ', series: 'X' }))).toBe(editionKey(entry('b', { title: 'ete' })));
  });
});

describe('editionGroups', () => {
  it('links the same book in two formats', () => {
    const cbz = entry('a');
    const pdf = entry('b', { path: '/comics/b.pdf' });
    const groups = editionGroups([cbz, pdf]);
    expect(groups.get('a')).toEqual([cbz, pdf]);
    expect(groups.get('b')).toEqual([cbz, pdf]);
  });

  it('keeps two files of the same format apart', () => {
    expect(editionGroups([entry('a'), entry('b')]).size).toBe(0);
  });

  it('keeps different volumes of a series apart', () => {
    const groups = editionGroups([
      entry('a', { series: 'S', volume: '1', title: 'One' }),
      entry('b', { series: 'S', volume: '2', title: 'Two', path: '/comics/b.pdf' }),
    ]);
    expect(groups.size).toBe(0);
  });
});

describe('collapseEditions', () => {
  it('keeps the first entry of each book, in order', () => {
    const cbz = entry('a');
    const other = entry('c', { title: 'Other' });
    const pdf = entry('b', { path: '/comics/b.pdf' });
    const groups = editionGroups([cbz, other, pdf]);
    expect(collapseEditions([pdf, other, cbz], groups).map((e) => e.id)).toEqual(['b', 'c']);
  });
});
