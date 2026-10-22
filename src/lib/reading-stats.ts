/**
 * Pure logic of the statistics page: the library's totals, the reading history grouped by month
 * or year, and the formatting of durations and period labels.
 * @module
 */
import { isFinished } from '@/lib/reading-list';
import { currentLanguage, t } from '@/shared/i18n';
import type { LibraryEntry } from '@/shared/library';
import type { ReadingStats } from '@/shared/stats';

/** How the history is grouped. */
export type StatsPeriod = 'month' | 'year';

/** How many months the monthly charts show, the current one included. */
export const MONTHS_SHOWN = 12;

/** What the library holds right now. */
export interface LibraryTotals {
  /** Number of books. */
  books: number;
  /** Books counting as read (see `isFinished()`), whenever they were. */
  read: number;
  /** Size of the files on disk, in bytes. */
  bytes: number;
}

/** One bar of a chart: what happened during a month (`YYYY-MM`) or a year (`YYYY`). */
export interface StatsBucket {
  /** `YYYY-MM` or `YYYY`. */
  key: string;
  /** Books finished during the period. */
  booksRead: number;
  /** Seconds spent reading during the period. */
  seconds: number;
}

/** One point of the library's growth: the number of books at the end of a month or a year. */
export interface LibraryGrowthPoint {
  /** `YYYY-MM` or `YYYY`. */
  key: string;
  /** Books in the library at the end of the period. */
  books: number;
}

/** The library's totals: book count, books read and size on disk. */
export function libraryTotals(entries: LibraryEntry[]): LibraryTotals {
  return {
    books: entries.length,
    read: entries.filter(isFinished).length,
    bytes: entries.reduce((sum, entry) => sum + entry.fileSize, 0),
  };
}

/** The key (`YYYY-MM` or `YYYY`) of the local month or year a date falls in. */
export function periodKey(date: Date, period: StatsPeriod): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  return period === 'year' ? year : `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Every key of the period shown, oldest first, ending with `now`'s: the last months, or each year since `firstYear`. */
function periodKeys(period: StatsPeriod, now: Date, firstYear: number): string[] {
  if (period === 'year') {
    const keys: string[] = [];
    for (let year = Math.min(firstYear, now.getFullYear()); year <= now.getFullYear(); year++) {
      keys.push(String(year).padStart(4, '0'));
    }
    return keys;
  }
  return Array.from({ length: MONTHS_SHOWN }, (_, index) =>
    periodKey(new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - index), 1), 'month'),
  );
}

/**
 * The history grouped by month (the last {@link MONTHS_SHOWN}) or by year (from the first one with
 * data), oldest first, with empty periods kept as zeros so the charts have no gaps. Dates are
 * read in the local time zone.
 */
export function buildBuckets(stats: ReadingStats, period: StatsPeriod, now = new Date()): StatsBucket[] {
  const length = period === 'year' ? 4 : 7;
  const finishedKeys = stats.finished.map((iso) => periodKey(new Date(iso), period));
  const dayKeys = stats.days.map((day) => day.day.slice(0, length));
  const years = [...finishedKeys, ...dayKeys].map((key) => Number(key.slice(0, 4)));
  const keys = periodKeys(period, now, years.length > 0 ? Math.min(...years) : now.getFullYear());

  const buckets = new Map(keys.map((key) => [key, { key, booksRead: 0, seconds: 0 }]));
  for (const key of finishedKeys) {
    const bucket = buckets.get(key);
    if (bucket) bucket.booksRead += 1;
  }
  stats.days.forEach((day, index) => {
    const bucket = buckets.get(dayKeys[index]);
    if (bucket) bucket.seconds += day.seconds;
  });
  return [...buckets.values()];
}

/**
 * How many books the library holds at the end of each period (the last {@link MONTHS_SHOWN}
 * months, or each year since the first book was added), oldest first. It is rebuilt from the
 * date each book now in the library was added: a book removed since is no longer counted, not
 * even in the periods when it was there. Dates are read in the local time zone.
 */
export function buildLibraryGrowth(entries: LibraryEntry[], period: StatsPeriod, now = new Date()): LibraryGrowthPoint[] {
  const addedKeys = entries.map((entry) => periodKey(new Date(entry.addedAt), period));
  const years = addedKeys.map((key) => Number(key.slice(0, 4)));
  const keys = periodKeys(period, now, years.length > 0 ? Math.min(...years) : now.getFullYear());

  // Zero-padded keys sort chronologically as strings, so a book counts from its period onwards.
  return keys.map((key) => ({ key, books: addedKeys.filter((added) => added <= key).length }));
}

/** Total reading time of the whole history, in seconds. */
export function totalSeconds(stats: ReadingStats): number {
  return stats.days.reduce((sum, day) => sum + day.seconds, 0);
}

/** A duration in the current language, rounded to the minute: "45 min", "3 h", "3 h 20 min". */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('stats:duration.minutes', { count: minutes });
  if (minutes === 0) return t('stats:duration.hours', { count: hours });
  return t('stats:duration.hoursMinutes', { hours, minutes });
}

/** A bucket key as a label in the current language: "Oct. 2026" / "oct. 2026" for a month, "2026" for a year. */
export function periodLabel(key: string): string {
  if (key.length === 4) return key;
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(currentLanguage(), { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1),
  );
}
