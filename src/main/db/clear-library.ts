/**
 * Emptying the library (`data:clear-library`) as one write.
 * @module
 */
import type { DatabaseSync } from 'node:sqlite';

import type { LibraryRepository } from './library-repository';
import type { ReadingListRepository } from './reading-list-repository';
import { withTransaction } from './transaction';

/** What {@link clearLibraryData} deleted. */
export interface ClearedLibrary {
  /** Library entries deleted. */
  entries: number;
  /** Reading lists of the active user deleted. */
  readingLists: number;
}

/**
 * Deletes the active user's reading lists, then every library entry (with its credits, the people and
 * everyone's progress), in one transaction: a failure on the second step leaves the lists as they were,
 * instead of lists emptied of a library that is still there. `db` must be the database both repositories use.
 */
export function clearLibraryData(
  db: DatabaseSync,
  libraryRepo: LibraryRepository,
  readingListRepo: ReadingListRepository,
): ClearedLibrary {
  return withTransaction(db, () => {
    const readingLists = readingListRepo.clear();
    const entries = libraryRepo.clear();
    return { entries, readingLists };
  });
}
