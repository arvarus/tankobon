/**
 * Selection of the books the home page offers to resume.
 * @module
 */
import type { LibraryEntry } from '@/shared/library';

import { isFinished } from './reading-list';

/** How many books the home page's "continue reading" block offers. */
export const CONTINUE_READING_COUNT = 5;

/**
 * The books to pick up again: the most recently opened ones that were started (past the first
 * page) and are not finished. A book only added to the library has an opening date too, but
 * was never read, hence the `currentPage` test. `library` is in the store's order (most recently
 * opened first), which is kept.
 */
export function continueReading(library: LibraryEntry[], count = CONTINUE_READING_COUNT): LibraryEntry[] {
  return library.filter((entry) => entry.currentPage > 0 && !isFinished(entry)).slice(0, count);
}
