import { describe, expect, it } from 'vitest';

import {
  collapseEditions,
  duplicateGroupKey,
  duplicateGroups,
  editionGroups,
  editionKey,
  rememberIgnoredGroups,
} from './library-editions';
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

describe('duplicateGroups', () => {
  it('groups the files of the same book and format, in library order', () => {
    const groups = duplicateGroups([
      entry('a', { title: 'Tintin' }),
      entry('b', { title: 'Other' }),
      entry('c', { title: ' tintin ' }),
      entry('d', { title: 'Tintin', path: '/comics/d.pdf' }),
    ]);
    expect(groups.map((group) => group.map((e) => e.id))).toEqual([['a', 'c']]);
  });

  it('does not group files whose title differs, even with the same series and volume', () => {
    const same = { series: 'Tintin', volume: '1' };
    const groups = duplicateGroups([
      entry('a', { ...same, title: 'Au Tibet' }),
      entry('b', { ...same, title: 'Le Lotus bleu' }),
    ]);
    expect(groups).toEqual([]);
  });

  it('does not group files whose language differs, but ignores its case', () => {
    expect(duplicateGroups([entry('a', { language: 'fr' }), entry('b', { language: 'en' })])).toEqual([]);
    expect(duplicateGroups([entry('a', { language: 'fr' }), entry('b', { language: 'FR' })])).toHaveLength(1);
    expect(duplicateGroups([entry('a'), entry('b')])).toHaveLength(1);
  });

  it('is empty when every book is in one file per format', () => {
    expect(duplicateGroups([entry('a'), entry('b', { path: '/comics/b.pdf' })])).toEqual([]);
  });
});

describe('duplicateGroupKey', () => {
  it('does not depend on the order of the entries, and changes when a file joins the group', () => {
    expect(duplicateGroupKey([entry('b'), entry('a')])).toBe(duplicateGroupKey([entry('a'), entry('b')]));
    expect(duplicateGroupKey([entry('a'), entry('b'), entry('c')])).not.toBe(duplicateGroupKey([entry('a'), entry('b')]));
  });
});

describe('rememberIgnoredGroups', () => {
  it('adds new keys once and keeps the newest within the limit', () => {
    const ab = [entry('a'), entry('b')];
    const cd = [entry('c'), entry('d')];
    const once = rememberIgnoredGroups([], [ab], 10);
    expect(rememberIgnoredGroups(once, [ab], 10)).toEqual(once);
    expect(rememberIgnoredGroups(once, [cd], 1)).toEqual([duplicateGroupKey(cd)]);
  });
});
