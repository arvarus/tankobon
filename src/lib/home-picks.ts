/**
 * Pure logic of the home page's suggestions: a random selection among the books not read yet.
 * @module
 */
import { isFinished } from '@/lib/reading-list';
import type { LibraryEntry } from '@/shared/library';

/** How many books the home page suggests. */
export const HOME_PICK_COUNT = 5;

/**
 * Up to `count` distinct books drawn at random among those not finished yet (see `isFinished()`;
 * a book already started still counts as unread). Fewer are returned when the library holds
 * fewer. `random` is injectable for tests and returns a number in [0, 1) like `Math.random`.
 */
export function pickRandomUnread(
  library: readonly LibraryEntry[],
  count: number = HOME_PICK_COUNT,
  random: () => number = Math.random,
): LibraryEntry[] {
  const pool = library.filter((entry) => !isFinished(entry));
  // Partial Fisher-Yates: only the first `count` slots need shuffling.
  const picks = Math.min(count, pool.length);
  for (let i = 0; i < picks; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, picks);
}
