import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import { clearLibraryData } from './clear-library';
import { LibraryRepository } from './library-repository';
import { ReadingListRepository } from './reading-list-repository';
import { migrate } from './schema';

function setup() {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  const library = new LibraryRepository(db);
  const lists = new ReadingListRepository(db);
  const book = library.touch('/comics/one.cbz', 'One', 10, 10, 1);
  library.touch('/comics/two.cbz', 'Two', 10, 10, 1);
  const created = lists.create('Favourites');
  if (created.status !== 'ok') throw new Error('list not created');
  lists.addEntry(created.list.id, book.id);
  return { db, library, lists };
}

describe('clearLibraryData', () => {
  it('deletes the lists and the entries, and counts them', () => {
    const { db, library, lists } = setup();
    expect(clearLibraryData(db, library, lists)).toEqual({ entries: 2, readingLists: 1 });
    expect(library.list()).toEqual([]);
    expect(lists.list()).toEqual([]);
  });

  it('leaves the reading lists untouched when emptying the library fails', () => {
    const { db, library, lists } = setup();
    vi.spyOn(library, 'clear').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => clearLibraryData(db, library, lists)).toThrow('boom');
    expect(lists.list()).toHaveLength(1);
    expect(lists.list()[0].entryIds).toHaveLength(1);
    expect(db.isTransaction).toBe(false);
  });
});
