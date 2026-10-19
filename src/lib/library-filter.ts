/**
 * Client-side search and filters of the library page (pure, no DOM).
 * @module
 */
import { currentLanguage } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';
import { formatPersonName } from '@/shared/title-parsing';

/** `'all'` means "don't filter on this"; a number keeps entries rated *at least* that many stars. */
export type RatingFilter = number | 'all';

/** State of the library toolbar. */
export interface LibraryFilters {
  /**
   * Free text matched against the title, the file path (so a folder name finds a series), the
   * series and the credited people's names.
   */
  search: string;
  /** Entries must carry *every* selected tag; an empty list doesn't filter. */
  tags: string[];
  rating: RatingFilter;
  /** Keeps only the entries without a fiche (see `hasFiche()`). */
  withoutFiche: boolean;
}

/** Filters that keep every entry. */
export const EMPTY_FILTERS: LibraryFilters = { search: '', tags: [], rating: 'all', withoutFiche: false };

/**
 * Every tag in use across the library, for the filter bar to offer. `first` (the library page's
 * quick tags) are listed ahead of the rest even when nothing carries them yet, so "Lu"/"À lire"
 * keep a stable position instead of appearing and moving as entries get tagged.
 */
export function availableTags(entries: LibraryEntry[], first: readonly string[] = []): string[] {
  const rest = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      if (!first.includes(tag)) rest.add(tag);
    }
  }
  return [...first, ...[...rest].sort((a, b) => a.localeCompare(b, currentLanguage()))];
}

/**
 * Lowercased and stripped of diacritics, so "pokemon" matches "Pokémon" — the titles come from
 * file names the user didn't necessarily type accented.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

/**
 * Normalized text the search box looks into, per entry: with thousands of entries, normalizing
 * them again on every keystroke is what makes typing lag. Entries are replaced, never mutated
 * (see `DataStore`), so a cached text can't go stale; a changed entry is a new key.
 */
const searchTexts = new WeakMap<LibraryEntry, string>();

/** The title, path, series and credited names of an entry, normalized and joined by newlines. */
function searchableText(entry: LibraryEntry): string {
  let text = searchTexts.get(entry);
  if (text === undefined) {
    text = normalize([entry.title, entry.path, entry.series ?? '', ...entry.credits.map(formatPersonName)].join('\n'));
    searchTexts.set(entry, text);
  }
  return text;
}

/**
 * Whether an entry has a fiche: some information beyond the title, whether typed by hand or
 * brought by a lookup (series, volume, release date, language or credits).
 */
export function hasFiche(entry: LibraryEntry): boolean {
  return Boolean(entry.series || entry.volume || entry.releaseDate || entry.language) || entry.credits.length > 0;
}

/** `matchesFilters` with the search text already normalized, so a whole list normalizes it once. */
function matches(entry: LibraryEntry, search: string, filters: LibraryFilters): boolean {
  if (search && !searchableText(entry).includes(search)) return false;
  if (!filters.tags.every((tag) => entry.tags.includes(tag))) return false;
  if (filters.rating !== 'all' && entry.rating < filters.rating) return false;
  if (filters.withoutFiche && hasFiche(entry)) return false;
  return true;
}

/** Whether an entry passes the search text, *every* selected tag, the minimum rating and the without-fiche filter. */
export function matchesFilters(entry: LibraryEntry, filters: LibraryFilters): boolean {
  return matches(entry, normalize(filters.search.trim()), filters);
}

/** The entries that pass `matchesFilters`, in their original order. */
export function filterEntries(entries: LibraryEntry[], filters: LibraryFilters): LibraryEntry[] {
  const search = normalize(filters.search.trim());
  return entries.filter((entry) => matches(entry, search, filters));
}

/** Whether any filter would narrow the list (whitespace-only search does not count). */
export function hasActiveFilters(filters: LibraryFilters): boolean {
  return filters.search.trim() !== '' || filters.tags.length > 0 || filters.rating !== 'all' || filters.withoutFiche;
}
