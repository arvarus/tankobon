import { describe, expect, it } from 'vitest';

import { availableLanguages, availableTags, EMPTY_FILTERS, filterEntries, hasActiveFilters, hasFiche } from './library-filter';
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

describe('availableTags', () => {
  it('lists the quick tags first, then the rest alphabetically', () => {
    const entries = [entry({ tags: ['Seinen', 'Lu'] }), entry({ tags: ['Humour', 'Seinen'] })];
    expect(availableTags(entries, ['Lu', 'À lire'])).toEqual(['Lu', 'À lire', 'Humour', 'Seinen']);
  });

  it('keeps the quick tags even when nothing carries them', () => {
    expect(availableTags([entry()], ['Lu'])).toEqual(['Lu']);
  });
});

describe('filterEntries', () => {
  const entries = [
    entry({ id: 'a', title: 'Pokémon', tags: ['Lu', 'Humour'], rating: 5 }),
    entry({ id: 'b', title: 'Astérix', tags: ['Lu'], rating: 3 }),
    entry({ id: 'c', title: 'Tintin', path: 'C:/bd/herge/tintin.cbr', tags: ['À lire'], rating: 0 }),
  ];

  const ids = (filters: Parameters<typeof filterEntries>[1]) =>
    filterEntries(entries, filters).map((e) => e.id);

  it('keeps everything with no filters', () => {
    expect(ids(EMPTY_FILTERS)).toEqual(['a', 'b', 'c']);
  });

  it('searches the series and the credited people too', () => {
    const withMetadata = [
      entry({ id: 'x', title: 'Le Lotus bleu', series: 'Les Aventures de Tintin' }),
      entry({
        id: 'y',
        title: 'Arctic Nation',
        credits: [{ personId: 'p', firstName: 'Juanjo', lastName: 'Guarnido', role: 'artist' }],
      }),
    ];
    const search = (text: string) => filterEntries(withMetadata, { ...EMPTY_FILTERS, search: text }).map((e) => e.id);
    expect(search('aventures')).toEqual(['x']);
    expect(search('juanjo guarnido')).toEqual(['y']);
  });

  it('searches the title ignoring case and accents', () => {
    expect(ids({ ...EMPTY_FILTERS, search: 'pokemon' })).toEqual(['a']);
    expect(ids({ ...EMPTY_FILTERS, search: 'ASTERIX' })).toEqual(['b']);
  });

  it('searches the file path too', () => {
    expect(ids({ ...EMPTY_FILTERS, search: 'herge' })).toEqual(['c']);
  });

  it('ignores surrounding whitespace in the search', () => {
    expect(ids({ ...EMPTY_FILTERS, search: '  tintin  ' })).toEqual(['c']);
  });

  it('filters on a tag', () => {
    expect(ids({ ...EMPTY_FILTERS, tags: ['Lu'] })).toEqual(['a', 'b']);
    expect(ids({ ...EMPTY_FILTERS, tags: ['À lire'] })).toEqual(['c']);
  });

  it('requires every selected tag', () => {
    expect(ids({ ...EMPTY_FILTERS, tags: ['Lu', 'Humour'] })).toEqual(['a']);
    expect(ids({ ...EMPTY_FILTERS, tags: ['Lu', 'À lire'] })).toEqual([]);
  });

  it('keeps entries rated at least the requested number of stars', () => {
    expect(ids({ ...EMPTY_FILTERS, rating: 3 })).toEqual(['a', 'b']);
    expect(ids({ ...EMPTY_FILTERS, rating: 5 })).toEqual(['a']);
  });

  it('combines the filters', () => {
    expect(ids({ search: 'i', tags: ['À lire'], rating: 'all', withoutFiche: false, language: 'all' })).toEqual(['c']);
    expect(ids({ search: 'i', tags: ['À lire'], rating: 1, withoutFiche: false, language: 'all' })).toEqual([]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('ignores a whitespace-only search', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '   ' })).toBe(false);
  });

  it('is true once a filter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tags: ['Lu'] })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, rating: 2 })).toBe(true);
  });
});

describe('without-fiche filter', () => {
  it('tells entries with and without a fiche apart', () => {
    expect(hasFiche(entry())).toBe(false);
    expect(hasFiche(entry({ series: 'Tintin' }))).toBe(true);
    expect(hasFiche(entry({ language: 'fr' }))).toBe(true);
    expect(hasFiche(entry({ credits: [{ firstName: 'Hergé', lastName: 'Remi', role: 'writer' }] as LibraryEntry['credits'] }))).toBe(true);
  });

  it('keeps only the entries without a fiche and counts as an active filter', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b', volume: '3' })];
    const filters = { ...EMPTY_FILTERS, withoutFiche: true };
    expect(filterEntries(entries, filters).map((e) => e.id)).toEqual(['a']);
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe('language filter', () => {
  const entries = [
    entry({ id: 'a', language: 'fr' }),
    entry({ id: 'b', language: 'EN' }),
    entry({ id: 'c', language: null }),
    entry({ id: 'd', language: 'fr' }),
  ];

  it('keeps only the entries in that language, ignoring the case of the stored code', () => {
    expect(filterEntries(entries, { ...EMPTY_FILTERS, language: 'fr' }).map((e) => e.id)).toEqual(['a', 'd']);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, language: 'en' }).map((e) => e.id)).toEqual(['b']);
  });

  it('counts as an active filter', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, language: 'fr' })).toBe(true);
  });

  it('lists each language in use once, lowercased, without the entries that have none', () => {
    expect(availableLanguages(entries).sort()).toEqual(['en', 'fr']);
  });
});
