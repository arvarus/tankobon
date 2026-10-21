/**
 * Persistence of the users (the `users` table) and of which one is using the app.
 * @module
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import { t } from '../../shared/i18n';
import {
  DEFAULT_USER_ID,
  MAX_AVATAR_BYTES,
  MAX_NICKNAME_LENGTH,
  avatarType,
  normalizeNickname,
  type AvatarType,
  type UserProfile,
  type UserResult,
} from '../../shared/users';
import { withTransaction } from './transaction';

interface UserRow {
  id: string;
  nickname: string;
  avatar: Uint8Array | null;
  avatar_type: string | null;
}

function fromRow(row: UserRow): UserProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    // A copy: the bytes are sent to the renderer, which must not share the database's buffer.
    avatar: row.avatar ? new Uint8Array(row.avatar) : null,
    avatarType: row.avatar ? (row.avatar_type as AvatarType | null) : null,
  };
}

/**
 * The users, and the one using the app (the `activeId` the other repositories scope their reads and
 * writes to). The active user is the one who was last switched to, so the app reopens on them.
 */
export class UserRepository {
  private active: string | null = null;

  constructor(private readonly db: DatabaseSync) {}

  /** Everyone, in the order they were created. */
  list(): UserProfile[] {
    const rows = this.db
      .prepare('SELECT id, nickname, avatar, avatar_type FROM users ORDER BY created_at, nickname')
      .all() as unknown as UserRow[];
    return rows.map(fromRow);
  }

  /** One user, or null when the id is unknown. */
  get(id: string): UserProfile | null {
    const row = this.db.prepare('SELECT id, nickname, avatar, avatar_type FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined;
    return row ? fromRow(row) : null;
  }

  private exists(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM users WHERE id = ?').get(id) !== undefined;
  }

  /** Id of the user using the app: the last one switched to (the first user on a database that never switched). */
  activeId(): string {
    // `exists()` and not `get()`: this runs several times per repository call, and `get()` copies the avatar.
    if (this.active === null || !this.exists(this.active)) {
      const row = this.db.prepare('SELECT id FROM users ORDER BY last_active_at DESC, created_at LIMIT 1').get() as
        | { id: string }
        | undefined;
      this.active = row?.id ?? DEFAULT_USER_ID;
    }
    return this.active;
  }

  /** Makes `id` the user using the app (and the one the app reopens on). False when the id is unknown. */
  switchTo(id: string): boolean {
    if (!this.get(id)) return false;
    // Strictly after every earlier switch, even within the same millisecond, so the last one always wins.
    const latest = (this.db.prepare('SELECT MAX(last_active_at) AS at FROM users').get() as { at: string }).at;
    const now = Date.now();
    const at = new Date(latest && Date.parse(latest) >= now ? Date.parse(latest) + 1 : now).toISOString();
    this.db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(at, id);
    this.active = id;
    return true;
  }

  private validateNickname(raw: string, exceptId?: string): { nickname: string } | { error: string } {
    const nickname = normalizeNickname(raw);
    if (nickname === '') return { error: t('errors:users.emptyNickname') };
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      return { error: t('errors:users.nicknameTooLong', { max: MAX_NICKNAME_LENGTH }) };
    }
    const taken = this.db
      .prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE AND id <> ?')
      .get(nickname, exceptId ?? '') as { id: string } | undefined;
    if (taken) return { error: t('errors:users.nicknameTaken', { nickname }) };
    return { nickname };
  }

  private ok(id: string): UserResult {
    const user = this.get(id);
    return user ? { status: 'ok', user } : { status: 'error', message: t('errors:users.notFound') };
  }

  /** Adds a user with the default picture; they start with the default settings and no history. It doesn't switch to them. */
  create(nickname: string): UserResult {
    const checked = this.validateNickname(nickname);
    if ('error' in checked) return { status: 'error', message: checked.error };
    const id = randomUUID();
    // An empty `last_active_at` sorts last: a new user doesn't become the one the app reopens on.
    this.db
      .prepare("INSERT INTO users (id, nickname, created_at, last_active_at) VALUES (?, ?, ?, '')")
      .run(id, checked.nickname, new Date().toISOString());
    return this.ok(id);
  }

  /** Changes a user's nickname (trimmed, not empty, unique ignoring case). */
  rename(id: string, nickname: string): UserResult {
    if (!this.get(id)) return { status: 'error', message: t('errors:users.notFound') };
    const checked = this.validateNickname(nickname, id);
    if ('error' in checked) return { status: 'error', message: checked.error };
    this.db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(checked.nickname, id);
    return this.ok(id);
  }

  /** Stores a profile picture (PNG, JPEG or WebP, at most `MAX_AVATAR_BYTES`), or removes it with `null`. */
  setAvatar(id: string, bytes: Uint8Array | null): UserResult {
    if (!this.get(id)) return { status: 'error', message: t('errors:users.notFound') };
    if (bytes === null) {
      this.db.prepare('UPDATE users SET avatar = NULL, avatar_type = NULL WHERE id = ?').run(id);
      return this.ok(id);
    }
    const type = avatarType(bytes);
    if (!type) return { status: 'error', message: t('errors:users.avatarFormat') };
    if (bytes.length > MAX_AVATAR_BYTES) return { status: 'error', message: t('errors:users.avatarTooLarge') };
    this.db.prepare('UPDATE users SET avatar = ?, avatar_type = ? WHERE id = ?').run(bytes, type, id);
    return this.ok(id);
  }

  /**
   * Deletes a user and everything personal they own (progress, ratings and tags, lists, reading time,
   * achievements, settings); the library and the other users are untouched. Refused for the last
   * remaining user. When the removed user was the active one, the app moves to the user active before
   * them, and the result is that user.
   */
  remove(id: string): UserResult {
    if (!this.get(id)) return { status: 'error', message: t('errors:users.notFound') };
    if (this.list().length < 2) return { status: 'error', message: t('errors:users.lastUser') };
    const wasActive = this.activeId() === id;
    withTransaction(this.db, () => {
      // Lists first: their items are found through the list's owner.
      this.db
        .prepare('DELETE FROM reading_list_items WHERE list_id IN (SELECT id FROM reading_lists WHERE user_id = ?)')
        .run(id);
      for (const table of ['reading_lists', 'reading_sessions', 'user_books', 'user_settings', 'user_achievements', 'user_library_folders']) {
        this.db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(id);
      }
      this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    if (!wasActive) return this.ok(this.activeId());
    this.active = null;
    return this.ok(this.activeId());
  }
}
