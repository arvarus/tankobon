/**
 * Selection of the books the home page suggests rediscovering (pure, no DOM).
 * @module
 */
import type { LibraryEntry } from '@/shared/library';

/** How many books the home page's "favorites" block shows. */
export const FAVORITES_COUNT = 5;

/**
 * The best-rated books to rediscover: rated entries only, highest rating first, and among equal
 * ratings the one opened longest ago first (a favorite read recently needs no reminder). Remaining
 * ties go to the title, so the choice is stable.
 */
export function topRated(entries: readonly LibraryEntry[], count: number = FAVORITES_COUNT): LibraryEntry[] {
  return entries
    .filter((entry) => entry.rating > 0)
    .sort(
      (a, b) =>
        b.rating - a.rating || a.lastOpenedAt.localeCompare(b.lastOpenedAt) || a.title.localeCompare(b.title),
    )
    .slice(0, count);
}
