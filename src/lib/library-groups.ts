/**
 * Grouping of the library page's rows by series (pure, no DOM).
 * @module
 */
import { currentLanguage } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';
import { isFinished } from '@/lib/reading-list';

/** Key of the group holding the entries that have no series. */
export const NO_SERIES_KEY = '';

/** A series heading of the grouped library list. */
export interface SeriesHeaderRow {
  /** Tells a heading from a book. */
  kind: 'series';
  /** The series name, lowercased and trimmed (`NO_SERIES_KEY` for the entries without one). */
  key: string;
  /** The series as shown: the first spelling met in the library, `null` for "no series". */
  series: string | null;
  /** Number of entries of the group that pass the filters. */
  count: number;
  /** Of those, how many are finished (`isFinished()`). */
  finished: number;
  /** Whether the group is folded: its entries are then left out of the rows. */
  collapsed: boolean;
}

/** A book of the library list. */
export interface EntryRow {
  /** Tells a book from a heading. */
  kind: 'entry';
  /** The book shown on the row. */
  entry: LibraryEntry;
}

/** One row of the library list: a series heading (grouped view only) or a book. */
export type LibraryRow = SeriesHeaderRow | EntryRow;

/** The entries as rows, in their order, with no heading: the library list when grouping is off. */
export function ungroupedRows(entries: LibraryEntry[]): EntryRow[] {
  return entries.map((entry) => ({ kind: 'entry', entry }));
}

/** The grouping key of a series: case and surrounding spaces don't make two series. */
export function seriesKey(series: string | null): string {
  return series?.trim().toLocaleLowerCase() ?? NO_SERIES_KEY;
}

/**
 * The entries grouped by series, each group behind a `SeriesHeaderRow`. Series come in alphabetical
 * order, the entries without a series last; within a series, books are sorted by volume (natural
 * order, so "2" comes before "10"; books without a volume after the others), then by title. A key in
 * `collapsed` keeps its heading but drops its books.
 */
export function groupBySeries(entries: LibraryEntry[], collapsed: ReadonlySet<string> = new Set()): LibraryRow[] {
  const groups = new Map<string, { series: string | null; entries: LibraryEntry[] }>();
  for (const entry of entries) {
    const key = seriesKey(entry.series);
    let group = groups.get(key);
    if (!group) {
      group = { series: key === NO_SERIES_KEY ? null : (entry.series?.trim() ?? null), entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }

  const collator = new Intl.Collator(currentLanguage(), { numeric: true, sensitivity: 'base' });
  const byVolume = (a: LibraryEntry, b: LibraryEntry) => {
    if (a.volume !== b.volume) {
      if (a.volume === null) return 1;
      if (b.volume === null) return -1;
      const order = collator.compare(a.volume, b.volume);
      if (order !== 0) return order;
    }
    return collator.compare(a.title, b.title);
  };
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === NO_SERIES_KEY) return 1;
    if (b === NO_SERIES_KEY) return -1;
    return collator.compare(a, b);
  });

  return keys.flatMap((key) => {
    const group = groups.get(key)!;
    const folded = collapsed.has(key);
    const header: SeriesHeaderRow = {
      kind: 'series',
      key,
      series: group.series,
      count: group.entries.length,
      finished: group.entries.filter(isFinished).length,
      collapsed: folded,
    };
    if (folded) return [header];
    return [header, ...[...group.entries].sort(byVolume).map((entry): EntryRow => ({ kind: 'entry', entry }))];
  });
}
