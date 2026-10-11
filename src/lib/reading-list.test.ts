import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyLanguage } from '@/shared/i18n';
import { READ_TAG, type LibraryEntry } from '@/shared/library';

import { MAX_READING_LIST_SIZE, type ReadingList } from '@/shared/reading-list';

import {
  bulkAddFeedback,
  bulkAddRequest,
  decodeDraggedEntries,
  dropFeedback,
  encodeDraggedEntries,
  isFinished,
  listEntries,
  listProgress,
  moveItem,
  moveUnfinished,
  nextToRead,
  seriesEntries,
  tagLabel,
} from './reading-list';

function entry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    path: `/comics/${id}.cbz`,
    title: id,
    pageCount: 10,
    currentPage: 0,
    addedAt: '2024-01-01',
    lastOpenedAt: '2024-01-01',
    fileCount: 10,
    fileSize: 1,
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

const done = (id: string) => entry(id, { currentPage: 9 });

describe('isFinished', () => {
  it('is true on the last page or with the Lu tag', () => {
    expect(isFinished(entry('a'))).toBe(false);
    expect(isFinished(entry('a', { currentPage: 8 }))).toBe(false);
    expect(isFinished(done('a'))).toBe(true);
    expect(isFinished(entry('a', { tags: ['Lu'] }))).toBe(true);
  });

  it('is false for an empty book never tagged', () => {
    expect(isFinished(entry('a', { pageCount: 0 }))).toBe(false);
  });
});

describe('listEntries', () => {
  it('follows the list order and skips ids missing from the library', () => {
    const library = [entry('a'), entry('b'), entry('c')];
    const list = { id: 'l', name: 'L', createdAt: '', entryIds: ['c', 'gone', 'a'] };
    expect(listEntries(list, library).map((e) => e.id)).toEqual(['c', 'a']);
  });
});

describe('listProgress', () => {
  it('counts finished books', () => {
    expect(listProgress([done('a'), entry('b'), entry('c'), done('d')])).toEqual({ finished: 2, total: 4, percent: 50 });
    expect(listProgress([])).toEqual({ finished: 0, total: 0, percent: 0 });
  });
});

describe('nextToRead', () => {
  it('is the first unfinished book', () => {
    expect(nextToRead([done('a'), entry('b'), entry('c')])?.id).toBe('b');
    expect(nextToRead([done('a'), entry('b'), entry('c')], 'b')?.id).toBe('c');
    expect(nextToRead([done('a')])).toBeNull();
  });
});

describe('moveUnfinished', () => {
  const finished = new Set(['x', 'y']);

  it('moves unfinished books around pinned finished ones', () => {
    // x and y keep their indices (0 and 2).
    expect(moveUnfinished(['x', 'a', 'y', 'b', 'c'], finished, 4, 1)).toEqual(['x', 'c', 'y', 'a', 'b']);
    expect(moveUnfinished(['x', 'a', 'y', 'b', 'c'], finished, 1, 4)).toEqual(['x', 'b', 'y', 'c', 'a']);
    expect(moveUnfinished(['a', 'b', 'c'], new Set(), 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('refuses to move a finished book or onto one', () => {
    expect(moveUnfinished(['x', 'a', 'b'], finished, 0, 1)).toBeNull();
    expect(moveUnfinished(['x', 'a', 'b'], finished, 2, 0)).toBeNull();
  });

  it('refuses no-op and out-of-range moves', () => {
    expect(moveUnfinished(['a', 'b'], finished, 1, 1)).toBeNull();
    expect(moveUnfinished(['a', 'b'], finished, 0, 2)).toBeNull();
    expect(moveUnfinished(['a', 'b'], finished, -1, 0)).toBeNull();
  });
});

describe('moveItem', () => {
  it('moves an item down or up, shifting the ones in between', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 0)).toEqual(['b', 'a']);
  });

  it('refuses a no-op or out-of-range move, leaving the input alone', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 1)).toBeNull();
    expect(moveItem(items, -1, 0)).toBeNull();
    expect(moveItem(items, 0, 3)).toBeNull();
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('dragged entry encoding', () => {
  it('round-trips one book or several', () => {
    const books = [{ id: 'a', title: 'Blacksad « T1 »' }, { id: 'b', title: 'Blacksad « T2 »' }];
    expect(decodeDraggedEntries(encodeDraggedEntries(books.slice(0, 1)))).toEqual(books.slice(0, 1));
    expect(decodeDraggedEntries(encodeDraggedEntries(books))).toEqual(books);
  });

  it('rejects anything else', () => {
    expect(decodeDraggedEntries('')).toBeNull();
    expect(decodeDraggedEntries('not json')).toBeNull();
    expect(decodeDraggedEntries('null')).toBeNull();
    expect(decodeDraggedEntries('[]')).toBeNull();
    expect(decodeDraggedEntries('{"id":"a","title":"x"}')).toBeNull();
    expect(decodeDraggedEntries('["a"]')).toBeNull();
    expect(decodeDraggedEntries('[{"id":"","title":"x"}]')).toBeNull();
    expect(decodeDraggedEntries('[{"id":1,"title":"x"}]')).toBeNull();
    expect(decodeDraggedEntries('[{"id":"a","title":"x"},{"id":"b"}]')).toBeNull();
  });
});

describe('dropFeedback', () => {
  beforeAll(() => applyLanguage('fr'));
  afterAll(() => applyLanguage('en'));

  const list: ReadingList = { id: 'l', name: 'Été', createdAt: '2024-01-01', entryIds: ['b'] };
  const ok = { status: 'ok' as const, list: { ...list, entryIds: ['b', 'a'] } };

  it('confirms an added book', () => {
    expect(dropFeedback(list, { id: 'a', title: 'Astérix' }, ok)).toEqual({
      message: '« Astérix » ajouté à « Été ».',
      error: false,
    });
  });

  it('says when the book was already in the list', () => {
    expect(dropFeedback(list, { id: 'b', title: 'Blake' }, { status: 'ok', list })).toEqual({
      message: '« Blake » est déjà dans « Été ».',
      error: false,
    });
  });

  it("passes a refusal's message on", () => {
    expect(dropFeedback(list, { id: 'a', title: 'Astérix' }, { status: 'error', message: 'Pleine.' })).toEqual({
      message: 'Pleine.',
      error: true,
    });
  });
});

describe('tagLabel', () => {
  afterAll(() => applyLanguage('en'));

  it('translates the quick tags and leaves the others alone', () => {
    applyLanguage('en');
    expect(tagLabel(READ_TAG)).toBe('Read');
    expect(tagLabel('À lire')).toBe('To read');
    expect(tagLabel('Prêté')).toBe('Prêté');
    applyLanguage('fr');
    expect(tagLabel(READ_TAG)).toBe('Lu');
  });
});

describe('seriesEntries', () => {
  const library = [
    entry('t10', { series: 'Astérix', volume: '10' }),
    entry('hs', { series: 'asterix ', volume: null, title: 'Hors-série' }),
    entry('t2', { series: 'Astérix', volume: '2' }),
    entry('other', { series: 'Tintin', volume: '1' }),
    entry('alone'),
  ];

  it('lists the series by natural volume order, ignoring case and accents, unnumbered last', () => {
    expect(seriesEntries(library[0], library).map((e) => e.id)).toEqual(['t2', 't10', 'hs']);
  });

  it('is just the book when it has no series', () => {
    expect(seriesEntries(library[4], library)).toEqual([library[4]]);
  });
});

describe('bulk adding', () => {
  beforeAll(() => applyLanguage('fr'));
  afterAll(() => applyLanguage('en'));

  const list: ReadingList = { id: 'l', name: 'Été', createdAt: '2024-01-01', entryIds: ['a'] };

  it('sends only the books not in the list yet, cut to the room left', () => {
    expect(bulkAddRequest(list, ['a', 'b', 'c', 'b'])).toEqual({ ids: ['b', 'c'], alreadyIn: 1, overLimit: 0 });
    const almostFull = { ...list, entryIds: Array.from({ length: MAX_READING_LIST_SIZE - 1 }, (_, i) => `x${i}`) };
    expect(bulkAddRequest(almostFull, ['b', 'c', 'd'])).toEqual({ ids: ['b'], alreadyIn: 0, overLimit: 2 });
  });

  it('sums up what was added and what was not', () => {
    const request = { ids: ['b', 'c'], alreadyIn: 1, overLimit: 1 };
    const result = { status: 'ok' as const, list, added: 2, alreadyIn: 0, overLimit: 0, missing: 0 };
    expect(bulkAddFeedback(list, request, result)).toEqual({
      message: `2 livres ajoutés à « Été » · 1 y était déjà · 1 non ajouté : la liste est pleine (${MAX_READING_LIST_SIZE} livres au maximum)`,
      error: false,
    });
  });

  it('is an error when nothing fit, or when the call was refused', () => {
    expect(bulkAddFeedback(list, { ids: [], alreadyIn: 0, overLimit: 3 }, null).error).toBe(true);
    expect(bulkAddFeedback(list, { ids: ['b'], alreadyIn: 0, overLimit: 0 }, { status: 'error', message: 'Non' })).toEqual({
      message: 'Non',
      error: true,
    });
  });
});
