/**
 * Reading statistics shared between the main process and the renderer (via preload).
 * @module
 */

/** Time spent reading on one local calendar day. */
export interface ReadingDay {
  /** Local date, `YYYY-MM-DD`. */
  day: string;
  /** Seconds spent with a book open and the window in use that day, all books together. */
  seconds: number;
}

/**
 * The history behind the statistics page: the raw material the renderer groups by month or year.
 * Only books finished and time spent after statistics were introduced are recorded.
 */
export interface ReadingStats {
  /** ISO timestamps at which a book was first finished (last page reached, or tagged `Lu`), oldest first. */
  finished: string[];
  /** Reading time per day, oldest first. */
  days: ReadingDay[];
}

/** One line of the profile's reading history: the time spent on a book during one local day. */
export interface ReadingHistoryEntry {
  /** Local date, `YYYY-MM-DD`. */
  day: string;
  /** Library id of the book; it may no longer be in the library. */
  libraryId: string;
  /** The book's title, `null` once it was removed from the library. */
  title: string | null;
  /** Seconds spent reading it that day. */
  seconds: number;
}

/** How many lines `stats:history` returns at most (the most recent ones). */
export const READING_HISTORY_LIMIT = 200;
