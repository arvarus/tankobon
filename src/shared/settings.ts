/**
 * Settings types shared between the main process and the renderer (via preload).
 * @module
 */
import { isSupportedLanguage, type LanguageSetting } from './i18n';

/** Modes of the library organization (see {@link AppSettings.libraryOrganization}). */
export type LibraryOrganization = 'off' | 'ask' | 'always';

/** User preferences, persisted key by key in the `settings` table (see `SettingsRepository`). */
export interface AppSettings {
  /** Interface language: one forced by the user, or `system` to follow the OS (English when it isn't supported). */
  language: LanguageSetting;
  /** Page-turn direction: left-to-right (BD/comics) or right-to-left (manga). */
  readingDirection: 'ltr' | 'rtl';
  /**
   * Whether opening a book adds it to the library when it isn't there yet. Off, a book that isn't in
   * the library is read anonymously: nothing is saved, and it reopens from its first page.
   */
  addOpenedBooksToLibrary: boolean;
  /**
   * How much each row of the library shows: `full` (cover, details, credits, file information, tags),
   * `medium` (cover, title, series and volume, progress) or `compact` (title, volume and series only).
   */
  libraryView: 'full' | 'medium' | 'compact';
  /** Whether the sidebar is collapsed to an icon-only rail. */
  sidebarCollapsed: boolean;
  /** Mouse/trackpad wheel direction in the reader: scrolling down advances or retreats a page. */
  scrollDirection: 'standard' | 'inverted';
  /** `single`: one page at a time. `continuous`: pages flow one after another in a vertical scroll. */
  readingMode: 'single' | 'continuous';
  /** Gap in pixels between pages in continuous mode (0 = pages touch). */
  pageSpacing: number;
  /** CSS color behind the pages in the reader (any `<input type="color">` value, i.e. `#rrggbb`). */
  readerBackground: string;
  /** Whether metadata lookups query Comic Vine (only when `comicVineApiKey` is set too). */
  comicVineEnabled: boolean;
  /** Personal Comic Vine API key (free, from comicvine.gamespot.com/api); Comic Vine refuses requests without one. */
  comicVineApiKey: string;
  /** Whether metadata lookups query Google Books. */
  googleBooksEnabled: boolean;
  /** Optional Google Books API key; without one, requests share Google's anonymous quota. */
  googleBooksApiKey: string;
  /** Whether the library is resynchronized with its folders in the background at every start. */
  resyncOnStartup: boolean;
  /** Whether the app asks GitHub at every start if a newer release exists, and offers to download it. */
  checkUpdatesOnStartup: boolean;
  /** When the last resynchronization finished (ISO 8601); empty when there has been none. */
  lastResyncAt: string;
  /**
   * Library organization: `off` leaves the files where they are; otherwise the comics added (a file,
   * a folder, a resynchronization) can be moved into `libraryOrganizationFolder`, each in its own
   * subfolder: `ask` offers it after each addition, `always` does it without asking. A comic found
   * directly in that folder is always moved, unless `off`.
   */
  libraryOrganization: LibraryOrganization;
  /**
   * Folder the library organization moves the comics into (empty until one is chosen). Set only by
   * the main process, through a folder dialog (`library:pick-organization-folder`): `settings:set` refuses it.
   */
  libraryOrganizationFolder: string;
  /** Folder last added with "Ajouter un dossier…" (empty before the first one): where the next folder dialog opens. */
  lastScanFolder: string;
}

/**
 * Value of every setting not stored yet. Merged under the stored values on read, so adding a key
 * needs no database migration.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  language: 'system',
  readingDirection: 'ltr',
  addOpenedBooksToLibrary: true,
  libraryView: 'full',
  sidebarCollapsed: false,
  scrollDirection: 'standard',
  readingMode: 'single',
  pageSpacing: 16,
  readerBackground: '#000000',
  comicVineEnabled: true,
  comicVineApiKey: '',
  googleBooksEnabled: true,
  googleBooksApiKey: '',
  resyncOnStartup: false,
  checkUpdatesOnStartup: true,
  lastResyncAt: '',
  lastScanFolder: '',
  libraryOrganization: 'off',
  libraryOrganizationFolder: '',
};

/** A reader background preset; its label is the `settings:appearance.backgrounds.<name>` translation. */
export interface ReaderBackgroundPreset {
  value: string;
  name: 'black' | 'darkGrey' | 'grey' | 'sepia' | 'white';
}

/** Presets offered in the settings page; the color picker accepts anything else. */
export const READER_BACKGROUND_PRESETS: ReaderBackgroundPreset[] = [
  { value: '#000000', name: 'black' },
  { value: '#262626', name: 'darkGrey' },
  { value: '#808080', name: 'grey' },
  { value: '#f4ecd8', name: 'sepia' },
  { value: '#ffffff', name: 'white' },
];

/** Largest `pageSpacing` accepted, in pixels. */
export const MAX_PAGE_SPACING = 1000;

/** One type guard per key of {@link AppSettings}. */
export type SettingValidators = { [K in keyof AppSettings]: (value: unknown) => value is AppSettings[K] };

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * One type guard per setting, the single definition of what a stored value may be. The main process
 * checks every `settings:set` call and every imported settings object against it, so neither a
 * compromised renderer nor a hand-edited export can store `readingMode: "webtoon"` or
 * `pageSpacing: -400`. A new setting needs an entry here (the type forces it).
 */
export const SETTING_VALIDATORS: SettingValidators = {
  language: (value): value is LanguageSetting => value === 'system' || (isString(value) && isSupportedLanguage(value)),
  readingDirection: (value): value is AppSettings['readingDirection'] => value === 'ltr' || value === 'rtl',
  addOpenedBooksToLibrary: isBoolean,
  libraryView: (value): value is AppSettings['libraryView'] =>
    value === 'full' || value === 'medium' || value === 'compact',
  sidebarCollapsed: isBoolean,
  scrollDirection: (value): value is AppSettings['scrollDirection'] => value === 'standard' || value === 'inverted',
  readingMode: (value): value is AppSettings['readingMode'] => value === 'single' || value === 'continuous',
  pageSpacing: (value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_PAGE_SPACING,
  readerBackground: (value): value is string => isString(value) && /^#[0-9a-fA-F]{6}$/.test(value),
  comicVineEnabled: isBoolean,
  comicVineApiKey: isString,
  googleBooksEnabled: isBoolean,
  googleBooksApiKey: isString,
  resyncOnStartup: isBoolean,
  checkUpdatesOnStartup: isBoolean,
  lastResyncAt: (value): value is string => isString(value) && (value === '' || !Number.isNaN(Date.parse(value))),
  lastScanFolder: isString,
  libraryOrganization: (value): value is LibraryOrganization => value === 'off' || value === 'ask' || value === 'always',
  libraryOrganizationFolder: isString,
};

/**
 * Settings only the main process writes: `settings:set` refuses them. The organized folder is one,
 * since the app moves files into it: the renderer never names a path (it goes through a folder dialog).
 */
export const MAIN_PROCESS_SETTINGS: readonly (keyof AppSettings)[] = ['libraryOrganizationFolder'];

/** Whether `key` names a setting of {@link AppSettings}. */
export function isSettingKey(key: unknown): key is keyof AppSettings {
  return typeof key === 'string' && Object.hasOwn(SETTING_VALIDATORS, key);
}

/** Whether `value` is acceptable for the setting `key` (see {@link SETTING_VALIDATORS}). */
export function isValidSetting<K extends keyof AppSettings>(key: K, value: unknown): value is AppSettings[K] {
  return SETTING_VALIDATORS[key](value);
}

/** The settings holding a secret: never sent to the views that don't need them (see {@link PublicSettings}). */
export const API_KEY_SETTINGS = ['comicVineApiKey', 'googleBooksApiKey'] as const;

/** Key of a secret setting. */
export type ApiKeySetting = (typeof API_KEY_SETTINGS)[number];

/** Whether `key` is one of the {@link API_KEY_SETTINGS}. */
export function isApiKeySetting(key: keyof AppSettings): key is ApiKeySetting {
  return (API_KEY_SETTINGS as readonly string[]).includes(key);
}

/** What `settings:get-all` returns: every setting except the API keys. */
export type PublicSettings = Omit<AppSettings, ApiKeySetting>;

/** The API keys, as returned by the dedicated `settings:get-api-keys` channel. */
export type ApiKeys = Pick<AppSettings, ApiKeySetting>;

/** `settings` without its API keys. */
export function toPublicSettings(settings: AppSettings): PublicSettings {
  const publicSettings: Partial<AppSettings> = { ...settings };
  for (const key of API_KEY_SETTINGS) delete publicSettings[key];
  return publicSettings as PublicSettings;
}

/** The API keys of `settings`. */
export function pickApiKeys(settings: AppSettings): ApiKeys {
  return { comicVineApiKey: settings.comicVineApiKey, googleBooksApiKey: settings.googleBooksApiKey };
}
