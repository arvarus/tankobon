/**
 * What the main process tells the renderer after writing to the database (the `data:changed`
 * push channel), shared between both sides.
 * @module
 */
import type { UnlockedAchievement } from './achievements';
import type { LibraryEntry } from './library';
import type { PublicSettings } from './settings';

/**
 * The library changed. With `upserted` and/or `removed`, only those entries did (the new state of
 * each one is carried along, so the renderer needs no extra request); with neither, anything may
 * have changed (a folder scan, a data import, clearing the library) and the renderer reloads it all.
 */
export interface LibraryChange {
  scope: 'library';
  /** Entries created or modified, in their new state. */
  upserted?: LibraryEntry[];
  /** Ids of entries deleted. */
  removed?: string[];
}

/** The reading lists changed; the renderer reloads them (there are few, and each is small). */
export interface ReadingListsChange {
  scope: 'readingLists';
}

/**
 * Settings changed: the `values` written, or, when absent, anything (a data import), so reload them all.
 * The API keys are never part of it (see `PublicSettings`).
 */
export interface SettingsChange {
  scope: 'settings';
  values?: Partial<PublicSettings>;
}

/** Achievements were earned: `unlocked` holds the new ones, so the renderer needs no extra request. */
export interface AchievementsChange {
  scope: 'achievements';
  /** The achievements earned by this write. */
  unlocked: UnlockedAchievement[];
}

/**
 * The users changed (one was added, edited, or the app switched to another). The renderer reloads
 * them, and when the active user is not the one it had, everything personal (library progress,
 * reading lists, settings, achievements) too.
 */
export interface UsersChange {
  scope: 'users';
}

/** The payload of a `data:changed` event, sent to the renderer after every database write. */
export type DataChange = LibraryChange | ReadingListsChange | SettingsChange | AchievementsChange | UsersChange;
