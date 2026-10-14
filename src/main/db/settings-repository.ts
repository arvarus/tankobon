/**
 * Persistence of the application settings (the `settings` table).
 * @module
 */
import type { DatabaseSync } from 'node:sqlite';

import { DEFAULT_SETTINGS, isSettingKey, isValidSetting, type AppSettings } from '../../shared/settings';

/** Persists application settings (key/value, JSON-encoded) to the local database. */
export class SettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * The stored settings, merged over `DEFAULT_SETTINGS` for any key not stored yet. A row that is
   * unreadable, unknown or no longer valid for its key (a hand-edited database, an older or newer
   * release) counts as not stored: it must not stop the app from starting.
   */
  getAll(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (!isSettingKey(row.key)) continue;
      let value: unknown;
      try {
        value = JSON.parse(row.value);
      } catch {
        continue;
      }
      if (isValidSetting(row.key, value)) (settings[row.key] as unknown) = value;
    }
    return settings;
  }

  /** Stores one setting (JSON-encoded), replacing any previous value. */
  set(key: keyof AppSettings, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, JSON.stringify(value));
  }
}
