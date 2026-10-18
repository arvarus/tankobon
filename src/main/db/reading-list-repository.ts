/**
 * Persistence of the reading lists (the `reading_lists` and `reading_list_items` tables).
 * @module
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { t } from '../../shared/i18n';
import {
  MAX_READING_LIST_SIZE,
  type ReadingList,
  type ReadingListAddResult,
  type ReadingListOrderResult,
  type ReadingListResult,
} from '../../shared/reading-list';
import { DEFAULT_USER_ID } from '../../shared/users';
import { withTransaction } from './transaction';

/** Whether `ids` holds exactly the members of `current`: same size, no duplicate, nothing foreign. */
function isSameSet(ids: string[], current: Set<string>): boolean {
  return ids.length === current.size && new Set(ids).size === current.size && ids.every((id) => current.has(id));
}

interface ReadingListRow {
  id: string;
  name: string;
  created_at: string;
}

/** Built on each use, so the message follows the interface language. */
const notFound = (): ReadingListResult => ({ status: 'error', message: t('errors:readingLists.notFound') });

/**
 * Persists the reading lists: named, ordered piles of library entries. Changes that can be
 * refused (full list, empty name, unknown list) resolve to a `ReadingListResult` error.
 */
export class ReadingListRepository {
  /** `userId` says whose lists these are (the active user, in the app): each user has their own. */
  constructor(
    private readonly db: DatabaseSync,
    private readonly userId: () => string = () => DEFAULT_USER_ID,
  ) {}

  /** Every list of the user, in the order they gave them (new lists last). */
  list(): ReadingList[] {
    const rows = this.db
      .prepare('SELECT * FROM reading_lists WHERE user_id = ? ORDER BY position, created_at, name')
      .all(this.userId()) as unknown as ReadingListRow[];
    const items = new Map<string, string[]>();
    const itemRows = this.db
      .prepare(
        `SELECT i.list_id, i.library_id FROM reading_list_items i
         JOIN reading_lists r ON r.id = i.list_id WHERE r.user_id = ? ORDER BY i.list_id, i.position`,
      )
      .all(this.userId()) as unknown as { list_id: string; library_id: string }[];
    for (const row of itemRows) {
      const ids = items.get(row.list_id) ?? [];
      ids.push(row.library_id);
      items.set(row.list_id, ids);
    }
    return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, entryIds: items.get(row.id) ?? [] }));
  }

  /** Whether a list with this id exists but belongs to another user (an imported list must then get a new id). */
  isForeign(id: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM reading_lists WHERE id = ? AND user_id <> ?').get(id, this.userId()) !== undefined
    );
  }

  /** One list by id, or null if it doesn't exist (anymore). */
  get(id: string): ReadingList | null {
    const row = this.db.prepare('SELECT * FROM reading_lists WHERE id = ? AND user_id = ?').get(id, this.userId()) as
      | ReadingListRow
      | undefined;
    return row ? { id: row.id, name: row.name, createdAt: row.created_at, entryIds: this.entryIdsOf(id) } : null;
  }

  private entryIdsOf(id: string): string[] {
    const rows = this.db
      .prepare('SELECT library_id FROM reading_list_items WHERE list_id = ? ORDER BY position')
      .all(id) as unknown as { library_id: string }[];
    return rows.map((row) => row.library_id);
  }

  private ok(id: string): ReadingListResult {
    const list = this.get(id);
    return list ? { status: 'ok', list } : notFound();
  }

  /** Creates an empty list, after the existing ones. The name is trimmed and must not be empty. */
  create(name: string): ReadingListResult {
    const trimmed = name.trim();
    if (trimmed === '') {
      return { status: 'error', message: t('errors:readingLists.emptyName') };
    }
    const id = randomUUID();
    this.insert(id, trimmed, new Date().toISOString());
    return this.ok(id);
  }

  /** Renames a list. The name is trimmed and must not be empty. */
  rename(id: string, name: string): ReadingListResult {
    const trimmed = name.trim();
    if (trimmed === '') {
      return { status: 'error', message: t('errors:readingLists.emptyName') };
    }
    this.db.prepare('UPDATE reading_lists SET name = ? WHERE id = ? AND user_id = ?').run(trimmed, id, this.userId());
    return this.ok(id);
  }

  /**
   * Stores a new order for the lists themselves (the order of {@link list}). `listIds` must hold
   * exactly the current lists: a stale order (a list was created or deleted in the meantime) is
   * refused, like {@link reorder}'s.
   */
  reorderLists(listIds: string[]): ReadingListOrderResult {
    const current = new Set(this.list().map((list) => list.id));
    if (!isSameSet(listIds, current)) {
      return { status: 'error', message: t('errors:readingLists.listsChanged') };
    }
    const write = this.db.prepare('UPDATE reading_lists SET position = ? WHERE id = ?');
    withTransaction(this.db, () => listIds.forEach((id, position) => write.run(position, id)));
    return { status: 'ok', lists: this.list() };
  }

  /** Deletes a list; the books it held stay in the library. */
  remove(id: string): void {
    if (!this.get(id)) return;
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM reading_list_items WHERE list_id = ?').run(id);
      this.db.prepare('DELETE FROM reading_lists WHERE id = ?').run(id);
    });
  }

  /** Deletes every list of the user; the books they held stay in the library. Returns how many were deleted. */
  clear(): number {
    const lists = this.list();
    withTransaction(this.db, () => lists.forEach((list) => this.remove(list.id)));
    return lists.length;
  }

  /**
   * Puts a library entry at the end of a list. A book already in the list stays where it is;
   * a list already holding `MAX_READING_LIST_SIZE` books refuses new ones.
   */
  addEntry(id: string, libraryId: string): ReadingListResult {
    const list = this.get(id);
    if (!list) {
      return notFound();
    }
    if (list.entryIds.includes(libraryId)) {
      return { status: 'ok', list };
    }
    if (list.entryIds.length >= MAX_READING_LIST_SIZE) {
      return {
        status: 'error',
        message: t('errors:readingLists.full', { name: list.name, max: MAX_READING_LIST_SIZE }),
      };
    }
    if (this.db.prepare('SELECT 1 FROM library WHERE id = ?').get(libraryId) === undefined) {
      return { status: 'error', message: t('errors:readingLists.entryGone') };
    }
    // After the last position rather than at `length`: removing a book from the library leaves a gap.
    this.db
      .prepare(
        `INSERT INTO reading_list_items (list_id, library_id, position)
         SELECT ?, ?, COALESCE(MAX(position) + 1, 0) FROM reading_list_items WHERE list_id = ?`,
      )
      .run(id, libraryId, id);
    return this.ok(id);
  }

  /**
   * Puts several library entries at the end of a list, in the order given, in one transaction.
   * Books already in the list stay where they are; once the list holds `MAX_READING_LIST_SIZE`
   * books the remaining ones are left out (counted in `overLimit`), and ids no longer in the
   * library are skipped (`missing`). Duplicates in `libraryIds` count once.
   */
  addEntries(id: string, libraryIds: string[]): ReadingListAddResult {
    const list = this.get(id);
    if (!list) {
      return { status: 'error', message: t('errors:readingLists.notFound') };
    }
    const present = new Set(list.entryIds);
    const exists = this.db.prepare('SELECT 1 FROM library WHERE id = ?');
    const counts = { added: 0, alreadyIn: 0, overLimit: 0, missing: 0 };
    const toAdd: string[] = [];
    for (const libraryId of new Set(libraryIds)) {
      if (present.has(libraryId)) counts.alreadyIn++;
      else if (exists.get(libraryId) === undefined) counts.missing++;
      else if (present.size + toAdd.length >= MAX_READING_LIST_SIZE) counts.overLimit++;
      else toAdd.push(libraryId);
    }
    const insert = this.db.prepare(
      `INSERT INTO reading_list_items (list_id, library_id, position)
       SELECT ?, ?, COALESCE(MAX(position) + 1, 0) FROM reading_list_items WHERE list_id = ?`,
    );
    withTransaction(this.db, () => toAdd.forEach((libraryId) => insert.run(id, libraryId, id)));
    counts.added = toAdd.length;
    return { status: 'ok', list: this.get(id) ?? list, ...counts };
  }

  /** Takes a library entry out of a list; the book stays in the library. */
  removeEntry(id: string, libraryId: string): ReadingListResult {
    if (!this.get(id)) {
      return notFound();
    }
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM reading_list_items WHERE list_id = ? AND library_id = ?').run(id, libraryId);
      this.writePositions(id, this.entryIdsOf(id));
    });
    return this.ok(id);
  }

  /**
   * Stores a new order for a list. `entryIds` must hold exactly the list's current entries: a
   * stale order (the list changed in the meantime) is refused rather than dropping or adding books.
   * Which books may move (not the finished ones) is the renderer's rule, see `moveUnfinished()`.
   */
  reorder(id: string, entryIds: string[]): ReadingListResult {
    const list = this.get(id);
    if (!list) {
      return notFound();
    }
    const current = new Set(list.entryIds);
    if (!isSameSet(entryIds, current)) {
      return { status: 'error', message: t('errors:readingLists.listChanged') };
    }
    this.writePositions(id, entryIds);
    return this.ok(id);
  }

  /**
   * Writes a whole list, matching an existing one by id (list ids are random UUIDs, so unlike
   * library ids they identify the same list across machines) — used by the JSON import. The
   * snapshot wins: name and entries are replaced. Entries beyond `MAX_READING_LIST_SIZE` are dropped.
   * An existing list keeps its place, a new one goes last; the import then applies the snapshot's
   * order with {@link reorderLists}.
   */
  upsert(list: ReadingList): 'created' | 'updated' {
    return withTransaction(this.db, () => this.writeList(list));
  }

  private writeList(list: ReadingList): 'created' | 'updated' {
    const exists = this.get(list.id) !== null;
    if (exists) {
      this.db
        .prepare('UPDATE reading_lists SET name = ?, created_at = ? WHERE id = ? AND user_id = ?')
        .run(list.name, list.createdAt, list.id, this.userId());
    } else {
      this.insert(list.id, list.name, list.createdAt);
    }
    this.db.prepare('DELETE FROM reading_list_items WHERE list_id = ?').run(list.id);
    this.writePositions(list.id, [...new Set(list.entryIds)].slice(0, MAX_READING_LIST_SIZE));
    return exists ? 'updated' : 'created';
  }

  private insert(id: string, name: string, createdAt: string): void {
    this.db
      .prepare(
        `INSERT INTO reading_lists (id, name, created_at, position, user_id)
         SELECT ?, ?, ?, COALESCE(MAX(position) + 1, 0), ? FROM reading_lists WHERE user_id = ?`,
      )
      .run(id, name, createdAt, this.userId(), this.userId());
  }

  private writePositions(id: string, entryIds: string[]): void {
    const write = this.db.prepare(
      'INSERT OR REPLACE INTO reading_list_items (list_id, library_id, position) VALUES (?, ?, ?)',
    );
    withTransaction(this.db, () => entryIds.forEach((libraryId, position) => write.run(id, libraryId, position)));
  }
}
