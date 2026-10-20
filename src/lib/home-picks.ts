/**
 * Pure logic of the home page's suggestions: a random selection among the books not read yet.
 * @module
 */
import { isFinished, seriesKey, sortByVolume } from '@/lib/reading-list';
import type { LibraryEntry } from '@/shared/library';

/** How many books the home page suggests. */
export const HOME_PICK_COUNT = 5;

/**
 * The unread books worth suggesting: books without a series, and for each series only its first
 * unread book in volume order, so volume 1 is proposed unless the previous volumes are already
 * read (then the next one is).
 */
function suggestable(library: readonly LibraryEntry[]): LibraryEntry[] {
  const pool: LibraryEntry[] = [];
  const series = new Map<string, LibraryEntry[]>();
  for (const entry of library) {
    if (!entry.series?.trim()) {
      if (!isFinished(entry)) pool.push(entry);
      continue;
    }
    const key = seriesKey(entry.series);
    const books = series.get(key);
    if (books) books.push(entry);
    else series.set(key, [entry]);
  }
  for (const books of series.values()) {
    const next = sortByVolume(books).find((book) => !isFinished(book));
    if (next) pool.push(next);
  }
  return pool;
}

/**
 * Up to `count` distinct books drawn at random among those not finished yet (see `isFinished()`;
 * a book already started still counts as unread), keeping only the next unread volume of each
 * series. Fewer are returned when the library holds
 * fewer. `random` is injectable for tests and returns a number in [0, 1) like `Math.random`.
 */
export function pickRandomUnread(
  library: readonly LibraryEntry[],
  count: number = HOME_PICK_COUNT,
  random: () => number = Math.random,
): LibraryEntry[] {
  const pool = suggestable(library);
  // Partial Fisher-Yates: only the first `count` slots need shuffling.
  const picks = Math.min(count, pool.length);
  for (let i = 0; i < picks; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, picks);
}
