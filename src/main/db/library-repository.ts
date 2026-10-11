/**
 * Persistence of the comic library (the `library` table).
 * @module
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import {
  READ_TAG,
  type Credit,
  type CreditInput,
  type CreditRole,
  type LibraryEntry,
  type MetadataUpdate,
} from '../../shared/library';
import { PeopleRepository } from './people-repository';
import { withTransaction } from './transaction';

interface LibraryRow {
  id: string;
  path: string;
  title: string;
  page_count: number;
  current_page: number;
  added_at: string;
  last_opened_at: string;
  file_count: number;
  file_size: number;
  rating: number;
  tags: string;
  title_locked: number;
  series: string | null;
  volume: string | null;
  release_date: string | null;
  language: string | null;
  avg_page_width: number | null;
  avg_page_height: number | null;
}

interface CreditRow {
  library_id: string;
  person_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

function fromRow(row: LibraryRow, credits: Credit[]): LibraryEntry {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    pageCount: row.page_count,
    currentPage: row.current_page,
    addedAt: row.added_at,
    lastOpenedAt: row.last_opened_at,
    fileCount: row.file_count,
    fileSize: row.file_size,
    rating: row.rating,
    tags: JSON.parse(row.tags) as string[],
    titleLocked: row.title_locked !== 0,
    series: row.series,
    volume: row.volume,
    releaseDate: row.release_date,
    language: row.language,
    avgPageWidth: row.avg_page_width,
    avgPageHeight: row.avg_page_height,
    credits,
  };
}

function creditFromRow(row: CreditRow): Credit {
  return { personId: row.person_id, firstName: row.first_name, lastName: row.last_name, role: row.role as CreditRole };
}

const CREDITS_QUERY = `
  SELECT c.library_id, c.person_id, p.first_name, p.last_name, c.role
  FROM credits c JOIN people p ON p.id = c.person_id`;

/** Persists the comic library (one row per known file) to the local database. */
export class LibraryRepository {
  private readonly people: PeopleRepository;

  constructor(private readonly db: DatabaseSync) {
    this.people = new PeopleRepository(db);
  }

  /** Every entry, most recently opened first. */
  list(): LibraryEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM library ORDER BY last_opened_at DESC')
      .all() as unknown as LibraryRow[];
    const credits = new Map<string, Credit[]>();
    const creditRows = this.db
      .prepare(`${CREDITS_QUERY} ORDER BY c.library_id, c.position`)
      .all() as unknown as CreditRow[];
    for (const row of creditRows) {
      const list = credits.get(row.library_id) ?? [];
      list.push(creditFromRow(row));
      credits.set(row.library_id, list);
    }
    return rows.map((row) => fromRow(row, credits.get(row.id) ?? []));
  }

  /** One entry by id, or null if it isn't (or no longer) in the library. */
  get(id: string): LibraryEntry | null {
    const row = this.db.prepare('SELECT * FROM library WHERE id = ?').get(id) as LibraryRow | undefined;
    return row ? fromRow(row, this.creditsOf(id)) : null;
  }

  private creditsOf(id: string): Credit[] {
    const rows = this.db
      .prepare(`${CREDITS_QUERY} WHERE c.library_id = ? ORDER BY c.position`)
      .all(id) as unknown as CreditRow[];
    return rows.map(creditFromRow);
  }

  /**
   * Registers a comic as just opened: creates it on first open, else refreshes its metadata.
   * Never touches `rating`/`tags` nor the looked-up metadata (series, credits…), which are only
   * ever set by the user, and keeps a locked title instead of the file-name-derived `title`.
   */
  touch(filePath: string, title: string, pageCount: number, fileCount: number, fileSize: number): LibraryEntry {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT * FROM library WHERE path = ?').get(filePath) as
      | LibraryRow
      | undefined;

    if (existing) {
      const currentPage = Math.min(existing.current_page, pageCount - 1);
      const newTitle = existing.title_locked !== 0 ? existing.title : title;
      this.db
        .prepare(
          `UPDATE library
           SET title = ?, page_count = ?, current_page = ?, file_count = ?, file_size = ?, last_opened_at = ?
           WHERE id = ?`,
        )
        .run(newTitle, pageCount, currentPage, fileCount, fileSize, now, existing.id);
      return fromRow(
        {
          ...existing,
          title: newTitle,
          page_count: pageCount,
          current_page: currentPage,
          file_count: fileCount,
          file_size: fileSize,
          last_opened_at: now,
        },
        this.creditsOf(existing.id),
      );
    }

    const row: LibraryRow = {
      id: randomUUID(),
      path: filePath,
      title,
      page_count: pageCount,
      current_page: 0,
      added_at: now,
      last_opened_at: now,
      file_count: fileCount,
      file_size: fileSize,
      rating: 0,
      tags: '[]',
      title_locked: 0,
      series: null,
      volume: null,
      release_date: null,
      language: null,
      avg_page_width: null,
      avg_page_height: null,
    };
    this.db
      .prepare(
        `INSERT INTO library
           (id, path, title, page_count, current_page, added_at, last_opened_at, file_count, file_size, rating, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.path,
        row.title,
        row.page_count,
        row.current_page,
        row.added_at,
        row.last_opened_at,
        row.file_count,
        row.file_size,
        row.rating,
        row.tags,
      );
    return fromRow(row, []);
  }

  /** Whether a file is already in the library, so a folder scan can skip it without opening it. */
  hasPath(filePath: string): boolean {
    return this.db.prepare('SELECT 1 FROM library WHERE path = ?').get(filePath) !== undefined;
  }

  /** Id of the entry whose file is `filePath`, or null when that file isn't in the library. */
  idOfPath(filePath: string): string | null {
    const row = this.db.prepare('SELECT id FROM library WHERE path = ?').get(filePath) as { id: string } | undefined;
    return row?.id ?? null;
  }

  /**
   * Points an entry at its file's new location, after the library organization moved it; everything
   * else (progress, rating, tags, metadata, reading-list places) stays. Returns false when the entry
   * is gone or another entry already has that path (paths are unique).
   */
  updatePath(id: string, filePath: string): boolean {
    if (this.hasPath(filePath)) return false;
    return Number(this.db.prepare('UPDATE library SET path = ? WHERE id = ?').run(filePath, id).changes) > 0;
  }

  /**
   * Adds a comic discovered by a folder scan. Unlike `touch`, an entry that already exists is left
   * completely alone — a scan is not a read, so it must not bump `last_opened_at` or refresh
   * metadata behind the user's back. New rows get `last_opened_at = added_at`, which is what puts
   * a freshly scanned batch at the top of the library list.
   */
  register(
    filePath: string,
    title: string,
    pageCount: number,
    fileCount: number,
    fileSize: number,
  ): 'created' | 'existing' {
    if (this.hasPath(filePath)) {
      return 'existing';
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO library
           (id, path, title, page_count, current_page, added_at, last_opened_at, file_count, file_size, rating, tags)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, '[]')`,
      )
      .run(randomUUID(), filePath, title, pageCount, now, now, fileCount, fileSize);
    return 'created';
  }

  /**
   * Writes a whole entry, matching an existing one by its file path (paths are unique, ids are
   * not stable across machines) — used by the JSON import to restore a snapshot on top of the
   * current library. Unlike `touch`, this does overwrite `rating`/`tags` and the looked-up
   * metadata, credits included: they're part of what the user is restoring.
   */
  upsert(entry: LibraryEntry): 'created' | 'updated' {
    return withTransaction(this.db, () => this.writeEntry(entry));
  }

  private writeEntry(entry: LibraryEntry): 'created' | 'updated' {
    const existing = this.db.prepare('SELECT id FROM library WHERE path = ?').get(entry.path) as
      | { id: string }
      | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE library
           SET title = ?, page_count = ?, current_page = ?, added_at = ?, last_opened_at = ?,
               file_count = ?, file_size = ?, rating = ?, tags = ?,
               title_locked = ?, series = ?, volume = ?, release_date = ?, language = ?,
               avg_page_width = ?, avg_page_height = ?
           WHERE id = ?`,
        )
        .run(
          entry.title,
          entry.pageCount,
          entry.currentPage,
          entry.addedAt,
          entry.lastOpenedAt,
          entry.fileCount,
          entry.fileSize,
          entry.rating,
          JSON.stringify(entry.tags),
          entry.titleLocked ? 1 : 0,
          entry.series,
          entry.volume,
          entry.releaseDate,
          entry.language,
          entry.avgPageWidth,
          entry.avgPageHeight,
          existing.id,
        );
      this.setCredits(existing.id, entry.credits);
      return 'updated';
    }

    // A fresh id when the snapshot's one is already taken by a different file.
    const id = this.idIsTaken(entry.id) ? randomUUID() : entry.id;
    this.db
      .prepare(
        `INSERT INTO library
           (id, path, title, page_count, current_page, added_at, last_opened_at, file_count, file_size, rating, tags,
            title_locked, series, volume, release_date, language, avg_page_width, avg_page_height)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        entry.path,
        entry.title,
        entry.pageCount,
        entry.currentPage,
        entry.addedAt,
        entry.lastOpenedAt,
        entry.fileCount,
        entry.fileSize,
        entry.rating,
        JSON.stringify(entry.tags),
        entry.titleLocked ? 1 : 0,
        entry.series,
        entry.volume,
        entry.releaseDate,
        entry.language,
        entry.avgPageWidth,
        entry.avgPageHeight,
      );
    this.setCredits(id, entry.credits);
    return 'created';
  }

  private idIsTaken(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM library WHERE id = ?').get(id) !== undefined;
  }

  /**
   * Path of the most recently opened comic, if any. Used to reopen the file dialog in the
   * directory the user last picked a book from, rather than the OS default.
   */
  lastOpenedPath(): string | null {
    const row = this.db
      .prepare('SELECT path FROM library ORDER BY last_opened_at DESC LIMIT 1')
      .get() as { path: string } | undefined;
    return row?.path ?? null;
  }

  /**
   * Saves the last page read (0-based) for resuming later. Reaching the last page also records
   * the book's first completion date (`finished_at`), for the reading statistics.
   */
  updateProgress(id: string, currentPage: number): void {
    this.db.prepare('UPDATE library SET current_page = ? WHERE id = ?').run(currentPage, id);
    this.db
      .prepare(
        'UPDATE library SET finished_at = ? WHERE id = ? AND finished_at IS NULL AND page_count > 0 AND current_page >= page_count - 1',
      )
      .run(new Date().toISOString(), id);
  }

  /** Sets the user rating: 0 (unrated) to 5. The value is stored as given, not clamped. */
  updateRating(id: string, rating: number): void {
    this.db.prepare('UPDATE library SET rating = ? WHERE id = ?').run(rating, id);
  }

  /** Stores the average page size measured by the background scan; returns the updated entry, or null if the id is unknown. */
  updateImageStats(id: string, width: number, height: number): LibraryEntry | null {
    this.db.prepare('UPDATE library SET avg_page_width = ?, avg_page_height = ? WHERE id = ?').run(width, height, id);
    return this.get(id);
  }

  /** The entries the background scan has yet to measure (id and path), most recently opened first. */
  unmeasured(): { id: string; path: string }[] {
    return this.db
      .prepare('SELECT id, path FROM library WHERE avg_page_width IS NULL ORDER BY last_opened_at DESC')
      .all() as unknown as { id: string; path: string }[];
  }

  /** Replaces the entry's tags. Tagging a book `Lu` also records its first completion date, like reaching its last page. */
  updateTags(id: string, tags: string[]): void {
    this.db.prepare('UPDATE library SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id);
    if (tags.includes(READ_TAG)) {
      this.db
        .prepare('UPDATE library SET finished_at = ? WHERE id = ? AND finished_at IS NULL')
        .run(new Date().toISOString(), id);
    }
  }

  /**
   * Writes the metadata fields present in `update` (typically the ones the user accepted from a
   * lookup) and leaves the others alone. A new title is locked, so reopening the file doesn't
   * put the file name back. Returns the updated entry, or null if the id is unknown.
   */
  updateMetadata(id: string, update: MetadataUpdate): LibraryEntry | null {
    if (!this.get(id)) {
      return null;
    }
    const columns: Record<string, string | number | null> = {};
    if (update.title !== undefined) {
      columns.title = update.title;
      columns.title_locked = 1;
    }
    if (update.series !== undefined) columns.series = update.series;
    if (update.volume !== undefined) columns.volume = update.volume;
    if (update.releaseDate !== undefined) columns.release_date = update.releaseDate;
    if (update.language !== undefined) columns.language = update.language;

    const names = Object.keys(columns);
    if (names.length > 0) {
      this.db
        .prepare(`UPDATE library SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`)
        .run(...Object.values(columns), id);
    }
    if (update.credits !== undefined) {
      this.setCredits(id, update.credits);
    }
    return this.get(id);
  }

  /**
   * Replaces an entry's credits, in the given order. People are matched by name (or created);
   * the same person in the same role twice is kept once. People no longer credited anywhere are
   * kept, for the future author pages.
   */
  private setCredits(id: string, credits: CreditInput[]): void {
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM credits WHERE library_id = ?').run(id);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO credits (library_id, person_id, role, position) VALUES (?, ?, ?, ?)',
      );
      credits.forEach((credit, position) => {
        if (credit.lastName.trim() === '') return;
        const person = this.people.findOrCreate(credit);
        insert.run(id, person.id, credit.role, position);
      });
    });
  }

  /**
   * Removes the entry (its credits, and its place in the reading lists) from the library; the
   * file on disk is left untouched.
   */
  remove(id: string): void {
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM credits WHERE library_id = ?').run(id);
      this.db.prepare('DELETE FROM reading_list_items WHERE library_id = ?').run(id);
      this.db.prepare('DELETE FROM library WHERE id = ?').run(id);
    });
  }

  /**
   * Empties the library: every entry, its credits and its place in the reading lists, plus the
   * people (who only exist through credits). The files on disk are left untouched. Returns the
   * number of entries removed.
   */
  clear(): number {
    const { count } = this.db.prepare('SELECT COUNT(*) AS count FROM library').get() as { count: number };
    this.db.exec(`
      DELETE FROM reading_list_items;
      DELETE FROM credits;
      DELETE FROM people;
      DELETE FROM library;
      DELETE FROM reading_sessions;
    `);
    return count;
  }
}
