/**
 * Sorting of the library page's books (pure, no DOM).
 * @module
 */
import { currentLanguage } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';
import type { LibrarySort } from '@/shared/settings';

/**
 * The entries in the requested order, as a new array. `lastOpened` keeps the given order (the store's
 * `lastOpenedAt DESC`). Dates compare as strings: the ISO timestamps of `addedAt` and the
 * `YYYY`/`YYYY-MM`/`YYYY-MM-DD` of `releaseDate`, where a shorter date sorts before the longer ones
 * of the same period. Books without a release date come last in both directions. Titles compare in
 * natural order ("Tome 2" before "Tome 10"), ignoring case and accents; equal keys fall back to the
 * title, then keep the given order.
 */
export function sortEntries(entries: readonly LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  if (sort === 'lastOpened') return [...entries];
  const collator = new Intl.Collator(currentLanguage(), { numeric: true, sensitivity: 'base' });
  const byTitle = (a: LibraryEntry, b: LibraryEntry) => collator.compare(a.title, b.title);
  const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  const compare = (a: LibraryEntry, b: LibraryEntry): number => {
    switch (sort) {
      case 'addedAsc':
        return compareStrings(a.addedAt, b.addedAt) || byTitle(a, b);
      case 'addedDesc':
        return compareStrings(b.addedAt, a.addedAt) || byTitle(a, b);
      case 'releaseAsc':
      case 'releaseDesc': {
        if (a.releaseDate === null || b.releaseDate === null) {
          if (a.releaseDate !== b.releaseDate) return a.releaseDate === null ? 1 : -1;
          return byTitle(a, b);
        }
        const order = compareStrings(a.releaseDate, b.releaseDate);
        return (sort === 'releaseAsc' ? order : -order) || byTitle(a, b);
      }
      case 'titleAsc':
        return byTitle(a, b);
      case 'titleDesc':
        return byTitle(b, a);
    }
  };
  return [...entries].sort(compare);
}
