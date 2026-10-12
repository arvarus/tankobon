/**
 * The home page's "recently added" block (pure, no DOM).
 * @module
 */
import type { LibraryEntry } from '@/shared/library';

/** How many books the home page's "recently added" block shows. */
export const RECENT_BOOKS_COUNT = 5;

/**
 * The `count` most recently added entries, newest first (ties keep the given order), as a new array.
 * `addedAt` is an ISO timestamp, so it compares as a string.
 */
export function recentlyAdded(entries: readonly LibraryEntry[], count: number = RECENT_BOOKS_COUNT): LibraryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.addedAt < b.entry.addedAt ? 1 : a.entry.addedAt > b.entry.addedAt ? -1 : a.index - b.index))
    .slice(0, count)
    .map(({ entry }) => entry);
}
