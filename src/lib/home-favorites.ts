/**
 * Selection of the books the home page suggests rediscovering (pure, no DOM).
 * @module
 */
import { sampleRandom } from '@/lib/home-picks';
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

/** The lowest rating that still counts as a favorite when drawing a new selection. */
export const FAVORITE_MIN_RATING = 4;

/**
 * A random selection of favorites: `count` books drawn among those rated {@link FAVORITE_MIN_RATING}
 * or more, best rated first. When fewer books are that well rated, the `count` best-rated ones
 * (see {@link topRated}) are the pool.
 */
export function pickRandomFavorites(
  entries: readonly LibraryEntry[],
  count: number = FAVORITES_COUNT,
  random: () => number = Math.random,
): LibraryEntry[] {
  const liked = entries.filter((entry) => entry.rating >= FAVORITE_MIN_RATING);
  const pool = liked.length > count ? liked : topRated(entries, count);
  return sampleRandom(pool, count, random).sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
}
