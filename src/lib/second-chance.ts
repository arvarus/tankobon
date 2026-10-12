/**
 * The home page's "second chance" list: the worst-rated books (pure, no DOM).
 * @module
 */
import { currentLanguage } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';

/** The highest rating (out of 5) a book can have and still be offered a second chance. */
export const SECOND_CHANCE_MAX_RATING = 2;

/** How many books the home page's list shows at most. */
export const SECOND_CHANCE_LIMIT = 10;

/**
 * The rated books at or below `SECOND_CHANCE_MAX_RATING`, worst rating first, then by title in
 * natural order (ignoring case and accents), cut to `limit`. Unrated books (0) are not "badly
 * rated" and are left out.
 */
export function secondChanceEntries(entries: readonly LibraryEntry[], limit = SECOND_CHANCE_LIMIT): LibraryEntry[] {
  const collator = new Intl.Collator(currentLanguage(), { numeric: true, sensitivity: 'base' });
  return entries
    .filter((entry) => entry.rating > 0 && entry.rating <= SECOND_CHANCE_MAX_RATING)
    .sort((a, b) => a.rating - b.rating || collator.compare(a.title, b.title))
    .slice(0, limit);
}
