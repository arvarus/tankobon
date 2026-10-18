/**
 * Persistence of the reading history behind the statistics page.
 * @module
 */
import type { DatabaseSync } from 'node:sqlite';

import { READING_HISTORY_LIMIT, type ReadingHistoryEntry, type ReadingStats } from '../../shared/stats';
import { DEFAULT_USER_ID } from '../../shared/users';

/** `YYYY-MM-DD` of `date` in the local time zone (what "that day" means to the user). */
export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Records the time the active user spent reading and reads their history back. */
export class StatsRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly userId: () => string = () => DEFAULT_USER_ID,
  ) {}

  /** Adds `seconds` of reading on `libraryId` to the day of `now`. */
  addReadingTime(libraryId: string, seconds: number, now = new Date()): void {
    this.db
      .prepare('INSERT INTO reading_sessions (user_id, library_id, day, seconds) VALUES (?, ?, ?, ?)')
      .run(this.userId(), libraryId, localDay(now), seconds);
  }

  /**
   * The active user's reading history, most recent first: one line per day and book, at most
   * `limit`. The title is `null` for a book removed from the library since.
   */
  history(limit = READING_HISTORY_LIMIT): ReadingHistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT s.day, s.library_id, l.title, SUM(s.seconds) AS seconds
         FROM reading_sessions s LEFT JOIN library l ON l.id = s.library_id
         WHERE s.user_id = ?
         GROUP BY s.day, s.library_id
         ORDER BY s.day DESC, MAX(s.id) DESC
         LIMIT ?`,
      )
      .all(this.userId(), limit) as { day: string; library_id: string; title: string | null; seconds: number }[];
    return rows.map((row) => ({ day: row.day, libraryId: row.library_id, title: row.title, seconds: row.seconds }));
  }

  /** Deletes the active user's reading sessions; books, progress, ratings and completion dates are kept. */
  clearHistory(): void {
    this.db.prepare('DELETE FROM reading_sessions WHERE user_id = ?').run(this.userId());
  }

  /** The history: completion dates and reading time per day, oldest first. */
  get(): ReadingStats {
    const finished = this.db
      .prepare(
        `SELECT ub.finished_at FROM user_books ub JOIN library l ON l.id = ub.library_id
         WHERE ub.user_id = ? AND ub.finished_at IS NOT NULL ORDER BY ub.finished_at`,
      )
      .all(this.userId()) as { finished_at: string }[];
    const days = this.db
      .prepare(
        'SELECT day, SUM(seconds) AS seconds FROM reading_sessions WHERE user_id = ? GROUP BY day ORDER BY day',
      )
      .all(this.userId()) as { day: string; seconds: number }[];
    return {
      finished: finished.map((row) => row.finished_at),
      days: days.map((row) => ({ day: row.day, seconds: row.seconds })),
    };
  }
}
