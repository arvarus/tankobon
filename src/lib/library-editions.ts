/**
 * Detection of the same book kept in several formats (a CBZ and a PDF), so the library page shows
 * it once (pure, no DOM). Nothing is stored: each file stays its own library entry, with its own
 * progress, rating and tags.
 * @module
 */
import { comicFormat } from '@/shared/comic';
import type { LibraryEntry } from '@/shared/library';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase();
}

/**
 * What makes two entries the same book: the series and volume when both are known, else the title,
 * compared ignoring case, accents and surrounding spaces.
 */
export function editionKey(entry: LibraryEntry): string {
  const series = entry.series ? normalize(entry.series) : '';
  const volume = entry.volume ? normalize(entry.volume) : '';
  return series && volume ? `s:${series}|${volume}` : `t:${normalize(entry.title)}`;
}

/**
 * The books that exist in at least two formats, as a map from the id of each of their entries to
 * all the editions of the book (one entry per format, in library order, the entry itself included).
 * Two files of the same format are not editions of each other: both stay separate books.
 */
export function editionGroups(entries: readonly LibraryEntry[]): Map<string, LibraryEntry[]> {
  const byKey = new Map<string, Map<string, LibraryEntry>>();
  for (const entry of entries) {
    const format = comicFormat(entry.path);
    if (format === null) continue;
    const key = editionKey(entry);
    let formats = byKey.get(key);
    if (!formats) byKey.set(key, (formats = new Map()));
    if (!formats.has(format)) formats.set(format, entry);
  }
  const groups = new Map<string, LibraryEntry[]>();
  for (const formats of byKey.values()) {
    if (formats.size < 2) continue;
    const editions = [...formats.values()];
    for (const edition of editions) groups.set(edition.id, editions);
  }
  return groups;
}

/**
 * `entries` with each book of `groups` kept once: its first entry in the list stands for it, the
 * other formats are left out. The order is kept.
 */
export function collapseEditions(
  entries: readonly LibraryEntry[],
  groups: ReadonlyMap<string, LibraryEntry[]>,
): LibraryEntry[] {
  const seen = new Set<LibraryEntry[]>();
  return entries.filter((entry) => {
    const editions = groups.get(entry.id);
    if (!editions) return true;
    if (seen.has(editions)) return false;
    seen.add(editions);
    return true;
  });
}
