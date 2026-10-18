/**
 * Persistence of the application settings: per user in the `user_settings` table, except the
 * `SHARED_SETTINGS`, which every user shares in the `settings` table.
 * @module
 */
import type { DatabaseSync } from 'node:sqlite';

import {
  DEFAULT_SETTINGS,
  isSettingKey,
  isSharedSetting,
  isValidSetting,
  type AppSettings,
} from '../../shared/settings';
import { DEFAULT_USER_ID } from '../../shared/users';

/** Persists application settings (key/value, JSON-encoded) to the local database. */
export class SettingsRepository {
  /** `userId` says whose settings are read and written (the active user, in the app). */
  constructor(
    private readonly db: DatabaseSync,
    private readonly userId: () => string = () => DEFAULT_USER_ID,
  ) {}

  /**
   * The stored settings, merged over `DEFAULT_SETTINGS` for any key not stored yet: the shared ones
   * as every user set them, the others as the active user did. A row that is unreadable, unknown,
   * no longer valid for its key (a hand-edited database, an older or newer release) or stored on
   * the wrong side counts as not stored: it must not stop the app from starting.
   */
  getAll(): AppSettings {
    const shared = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const personal = this.db
      .prepare('SELECT key, value FROM user_settings WHERE user_id = ?')
      .all(this.userId()) as { key: string; value: string }[];
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    const apply = (rows: { key: string; value: string }[], wantShared: boolean) => {
      for (const row of rows) {
        if (!isSettingKey(row.key) || isSharedSetting(row.key) !== wantShared) continue;
        let value: unknown;
        try {
          value = JSON.parse(row.value);
        } catch {
          continue;
        }
        if (isValidSetting(row.key, value)) (settings[row.key] as unknown) = value;
      }
    };
    apply(shared, true);
    apply(personal, false);
    return settings;
  }

  /** Stores one setting (JSON-encoded), replacing any previous value. */
  set(key: keyof AppSettings, value: unknown): void {
    if (isSharedSetting(key)) {
      this.db
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .run(key, JSON.stringify(value));
    } else {
      this.db
        .prepare(
          `INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?)
           ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
        )
        .run(this.userId(), key, JSON.stringify(value));
    }
  }
}
