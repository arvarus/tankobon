import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { SUPPORTED_COMIC_EXTENSIONS } from '../../shared/comic';
import { t } from '../../shared/i18n';
import type {
  AddFileResult,
  ImageScanProgress,
  OrganizationOutcome,
  OrganizeResult,
  PickOrganizationFolderResult,
  UnorganizedCountResult,
  ResyncResult,
  ScanProgress,
  ScanResult,
} from '../../shared/library';
import type { LibraryFolderRepository } from '../db/library-folder-repository';
import type { LibraryRepository } from '../db/library-repository';
import type { SettingsRepository } from '../db/settings-repository';
import type { DecoderClient } from '../decoder/decoder-client';
import type { ImageStatsScanner } from '../services/image-stats-scanner';
import {
  organizeEntries,
  planOrganization,
  unorganizedIds,
  type OrganizationTarget,
} from '../services/library-organizer';
import { openErrorMessage } from '../services/open-error';
import { scanIntoLibrary } from '../services/library-scanner';
import { resyncLibrary } from '../services/library-sync';
import { lastOpenedDirectory } from './comic';
import type { NotifyDataChange } from './data-changes';
import { existingDirectory, openDialogFor } from './dialogs';
import { handle } from './handle';
import {
  MAX_PATH_LENGTH,
  args,
  expectInteger,
  expectMetadataUpdate,
  expectNonEmptyString,
  expectStringArray,
  idArg,
  pageIndexArg,
} from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const LIBRARY_CHANNELS = {
  list: 'library:list',
  addFile: 'library:add-file',
  addFolder: 'library:add-folder',
  /** Main → renderer, while `addFolder` runs. */
  scanProgress: 'library:scan-progress',
  remove: 'library:remove',
  listFolders: 'library:list-folders',
  removeFolder: 'library:remove-folder',
  resync: 'library:resync',
  updateProgress: 'library:update-progress',
  updateRating: 'library:update-rating',
  updateTags: 'library:update-tags',
  updateMetadata: 'library:update-metadata',
  thumbnail: 'library:thumbnail',
  imageScanStatus: 'library:image-scan-status',
  /** Main → renderer, while the background measure of the pages runs. */
  imageScanProgress: 'library:image-scan-progress',
  pickOrganizationFolder: 'library:pick-organization-folder',
  organize: 'library:organize',
  countUnorganized: 'library:count-unorganized',
  organizeAll: 'library:organize-all',
} as const;

/** Sends the state of the background measure to every open window (one being closed is skipped). */
export function broadcastImageScanProgress(progress: ImageScanProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(LIBRARY_CHANNELS.imageScanProgress, progress);
    }
  }
}

/**
 * Lets one long run over the library files at a time (a resynchronization, or organizing the whole
 * library): moving files while a walk registers them could register a file twice.
 */
export interface LibraryRunLock {
  /** Takes the lock for `run`; false when another run holds it. */
  tryStart(run: 'resync' | 'organize'): boolean;
  /** Releases the lock. */
  end(): void;
  /** The translated refusal for a run that couldn't start. */
  busyMessage(): string;
}

function createLibraryRunLock(): LibraryRunLock {
  let holder: 'resync' | 'organize' | null = null;
  return {
    tryStart(run) {
      if (holder) return false;
      holder = run;
      return true;
    },
    end() {
      holder = null;
    },
    busyMessage() {
      return holder === 'resync' ? t('errors:library.resyncRunning') : t('errors:library.organizeRunning');
    },
  };
}

/** The library organization (`AppSettings.libraryOrganization`) as the handlers use it; built once in `main.ts`. */
export interface LibraryOrganizer {
  /**
   * The folders a resynchronization walks: the remembered ones, plus the organized folder when the
   * organization is on (so a comic dropped there by hand is found, then moved into place).
   */
  watchedFolders(folders: string[]): string[];
  /**
   * Applies the organization to the comics an addition just brought in (see `planOrganization`):
   * moves those to move now and keeps the others behind a token for `organize()`.
   */
  afterAdd(added: { id: string; path: string }[]): Promise<OrganizationOutcome>;
  /** Moves the comics an earlier `afterAdd()` offered, as the user accepted. A token works once. */
  organize(token: string): Promise<OrganizeResult>;
  /** How many library comics aren't in their place in the organized folder yet (an error when the organization is off or its folder unreachable). */
  countUnorganized(): Promise<UnorganizedCountResult>;
  /**
   * Moves every library comic not in its place yet into the organized folder, one at a time,
   * reporting each through `onProgress`. Holds the `lock`, like a resynchronization.
   */
  organizeAll(onProgress?: (progress: ScanProgress) => void): Promise<OrganizeResult>;
  /** The lock shared with the resynchronizer. */
  lock: LibraryRunLock;
}

/** How many offers `createLibraryOrganizer` remembers; an older token expires. */
const MAX_PENDING_OFFERS = 20;

const NOTHING_ORGANIZED: OrganizationOutcome = { moved: 0, failed: 0, pending: null };

async function isDirectory(folder: string): Promise<boolean> {
  try {
    return (await stat(folder)).isDirectory();
  } catch {
    return false;
  }
}

export function createLibraryOrganizer(
  repo: LibraryRepository,
  settings: SettingsRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
): LibraryOrganizer {
  // Token → ids of the comics offered. The renderer only ever holds the token, never a path or a
  // list it could make up.
  const offers = new Map<string, string[]>();
  const lock = createLibraryRunLock();

  const current = () => {
    const {
      libraryOrganization: mode,
      libraryOrganizationFolder: root,
      libraryStructure: structure,
      libraryFileName: fileName,
    } = settings.getAll();
    return { mode, root, structure, fileName };
  };

  /** The organized folder when the organization is on and its folder is there, else the error to return. */
  const usableRoot = async (): Promise<{ target: OrganizationTarget } | { status: 'error'; message: string }> => {
    const { mode, root, structure, fileName } = current();
    if (mode === 'off' || root === '') return { status: 'error', message: t('errors:library.organizationOff') };
    if (!(await isDirectory(root))) {
      return { status: 'error', message: t('errors:library.organizationFolderUnreachable', { folder: root }) };
    }
    return { target: { root, structure, fileName } };
  };

  const move = async (
    target: OrganizationTarget,
    ids: string[],
    onProgress?: (processed: number, total: number, file: string) => void,
  ) => {
    const summary = await organizeEntries(repo, target, ids, onProgress);
    if (summary.moved.length > 0) {
      notify({ scope: 'library' });
      // Covers are cached by path: the old ones are useless, the new ones come back on demand.
      await Promise.all(summary.moved.map((entry) => decoder.removeThumbnail(entry.from).catch(() => undefined)));
    }
    return { moved: summary.moved.length, failed: summary.failed };
  };

  return {
    watchedFolders(folders) {
      const { mode, root } = current();
      return mode === 'off' || root === '' || folders.includes(root) ? folders : [...folders, root];
    },

    async afterAdd(added) {
      const { mode, root, structure, fileName } = current();
      const plan = planOrganization(mode, root, added);
      if (plan.now.length === 0 && plan.offer.length === 0) return NOTHING_ORGANIZED;
      if (!(await isDirectory(root))) {
        // An unplugged drive: nothing moves, and offering would only fail again.
        return { moved: 0, failed: plan.now.length + plan.offer.length, pending: null };
      }
      const { moved, failed } = await move({ root, structure, fileName }, plan.now);
      if (plan.offer.length === 0) return { moved, failed, pending: null };

      const token = randomUUID();
      offers.set(token, plan.offer);
      for (const oldest of offers.keys()) {
        if (offers.size <= MAX_PENDING_OFFERS) break;
        offers.delete(oldest);
      }
      return { moved, failed, pending: { token, count: plan.offer.length, folder: root } };
    },

    async organize(token) {
      const ids = offers.get(token);
      if (!ids) return { status: 'error', message: t('errors:library.organizationExpired') };
      const usable = await usableRoot();
      if (!('target' in usable)) return usable;
      offers.delete(token);
      return { status: 'ok', ...(await move(usable.target, ids)) };
    },

    async countUnorganized() {
      const usable = await usableRoot();
      if (!('target' in usable)) return usable;
      return { status: 'ok', count: unorganizedIds(repo, usable.target).length, folder: usable.target.root };
    },

    async organizeAll(onProgress = () => undefined) {
      const usable = await usableRoot();
      if (!('target' in usable)) return usable;
      if (!lock.tryStart('organize')) return { status: 'error', message: lock.busyMessage() };
      try {
        const ids = unorganizedIds(repo, usable.target);
        const result = await move(usable.target, ids, (processed, total, currentFile) =>
          onProgress({ phase: 'importing', processed, total, currentFile }),
        );
        return { status: 'ok', ...result };
      } finally {
        onProgress({ phase: 'done', processed: 0, total: 0, currentFile: '' });
        lock.end();
      }
    },

    lock,
  };
}

/** Everything a resynchronization needs; built once in `main.ts`. */
export interface Resynchronizer {
  /**
   * Walks the library's folders again (new comics added, comics whose file is gone removed), stores
   * the date in `lastResyncAt` and tells the views. Only one runs at a time: a call during another
   * one resolves to an error result.
   */
  run(onProgress?: (progress: ScanProgress) => void): Promise<ResyncResult>;
}

export function createResynchronizer(
  repo: LibraryRepository,
  folders: LibraryFolderRepository,
  settings: SettingsRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
  imageScanner: ImageStatsScanner,
  organizer: LibraryOrganizer,
): Resynchronizer {
  return {
    async run(onProgress = () => undefined) {
      if (!organizer.lock.tryStart('resync')) return { status: 'error', message: organizer.lock.busyMessage() };
      try {
        const summary = await resyncLibrary(repo, organizer.watchedFolders(folders.list()), onProgress, (filePath) =>
          decoder.inspect(filePath),
        );
        const organization = await organizer.afterAdd(summary.addedEntries);
        const finishedAt = new Date().toISOString();
        settings.set('lastResyncAt', finishedAt);

        notify({ scope: 'library' });
        notify({ scope: 'settings', values: { lastResyncAt: finishedAt } });
        void imageScanner.kick();
        if (summary.removed > 0) {
          // The removed books left the reading lists they were in, and their covers are useless.
          notify({ scope: 'readingLists' });
          await Promise.all(summary.removedEntries.map((entry) => decoder.removeThumbnail(entry.path).catch(() => undefined)));
        }
        return {
          status: 'ok',
          added: summary.added,
          removed: summary.removed,
          failed: summary.failed,
          unreachable: summary.unreachable,
          finishedAt,
          organization,
        };
      } catch (error) {
        return { status: 'error', message: error instanceof Error ? error.message : String(error) };
      } finally {
        organizer.lock.end();
      }
    },
  };
}

export function registerLibraryIpc(
  repo: LibraryRepository,
  folders: LibraryFolderRepository,
  resynchronizer: Resynchronizer,
  settingsRepo: SettingsRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
  imageScanner: ImageStatsScanner,
  organizer: LibraryOrganizer,
): void {
  /** Announces the new state of entries a handler just wrote (the ones that still exist). */
  const notifyUpserted = (...ids: string[]) => {
    const upserted = ids.flatMap((id) => repo.get(id) ?? []);
    if (upserted.length > 0) notify({ scope: 'library', upserted });
  };

  handle(LIBRARY_CHANNELS.list, args(), () => repo.list());

  handle(LIBRARY_CHANNELS.addFile, args(), async (event): Promise<AddFileResult> => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:addFile'),
      properties: ['openFile'],
      filters: [{ name: t('dialogs:comicFiles'), extensions: [...SUPPORTED_COMIC_EXTENSIONS] }],
      defaultPath: await lastOpenedDirectory(repo),
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return { status: 'cancelled' };
    }

    const filePath = filePaths[0];
    const title = path.basename(filePath, path.extname(filePath));
    if (repo.hasPath(filePath)) {
      return { status: 'exists', title };
    }
    try {
      // Same path as a scanned file: the decoder counts the pages and caches the cover.
      const { pageCount, fileCount } = await decoder.inspect(filePath);
      const { size } = await stat(filePath);
      repo.register(filePath, title, pageCount, fileCount, size);
    } catch (error) {
      return { status: 'error', message: openErrorMessage(error) };
    }
    // New row: the library slice reloads (a targeted upsert would need the entry's id).
    notify({ scope: 'library' });
    const id = repo.idOfPath(filePath);
    const organization = id ? await organizer.afterAdd([{ id, path: filePath }]) : NOTHING_ORGANIZED;
    void imageScanner.kick();
    return { status: 'added', title, organization };
  });

  handle(LIBRARY_CHANNELS.addFolder, args(), async (event): Promise<ScanResult> => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:addFolder'),
      properties: ['openDirectory'],
      // Where the previous folder was added, when it is still there.
      defaultPath: await existingDirectory(settingsRepo.getAll().lastScanFolder),
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return { status: 'cancelled' };
    }

    const directory = filePaths[0];
    settingsRepo.set('lastScanFolder', directory);
    notify({ scope: 'settings', values: { lastScanFolder: directory } });
    const summary = await scanIntoLibrary(
      repo,
      directory,
      (progress) => {
        // The renderer may be gone (window closed mid-scan); dropping the update is enough.
        if (!event.sender.isDestroyed()) {
          event.sender.send(LIBRARY_CHANNELS.scanProgress, progress);
        }
      },
      (filePath) => decoder.inspect(filePath),
    );
    folders.add(directory);
    notify({ scope: 'library' });
    const organization = await organizer.afterAdd(summary.addedEntries);
    // The files are in: their pages are measured in the background, after the import.
    void imageScanner.kick();
    const { added, skipped, failed, total } = summary;
    return { status: 'ok', directory, added, skipped, failed, total, organization };
  });

  handle(LIBRARY_CHANNELS.pickOrganizationFolder, args(), async (event): Promise<PickOrganizationFolderResult> => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:chooseOrganizationFolder'),
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: await existingDirectory(settingsRepo.getAll().libraryOrganizationFolder),
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return { status: 'cancelled' };
    }
    const folder = filePaths[0];
    settingsRepo.set('libraryOrganizationFolder', folder);
    // Watched like the folders added from the library: a comic dropped there is found by a resynchronization.
    folders.add(folder);
    notify({ scope: 'settings', values: { libraryOrganizationFolder: folder } });
    return { status: 'ok', folder };
  });

  handle(
    LIBRARY_CHANNELS.organize,
    args((value) => expectNonEmptyString(value, 'token', 100)),
    (_event, token) => organizer.organize(token),
  );

  handle(LIBRARY_CHANNELS.countUnorganized, args(), () => organizer.countUnorganized());

  // Progress goes over the scan channel, which the settings page already follows for a resynchronization.
  handle(LIBRARY_CHANNELS.organizeAll, args(), (event) =>
    organizer.organizeAll((progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(LIBRARY_CHANNELS.scanProgress, progress);
      }
    }),
  );

  handle(LIBRARY_CHANNELS.listFolders, args(), () => folders.list());

  handle(
    LIBRARY_CHANNELS.removeFolder,
    args((value) => expectNonEmptyString(value, 'folder', MAX_PATH_LENGTH)),
    (_event, folder) => folders.remove(folder),
  );

  handle(LIBRARY_CHANNELS.resync, args(), (event) =>
    resynchronizer.run((progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(LIBRARY_CHANNELS.scanProgress, progress);
      }
    }),
  );

  handle(LIBRARY_CHANNELS.remove, args(idArg), async (_event, id) => {
    const entry = repo.get(id);
    repo.remove(id);
    notify({ scope: 'library', removed: [id] });
    // The book left the reading lists it was in.
    notify({ scope: 'readingLists' });
    if (entry) {
      await decoder.removeThumbnail(entry.path).catch(() => undefined);
    }
  });

  handle(LIBRARY_CHANNELS.updateProgress, args(idArg, pageIndexArg), (_event, id, currentPage) => {
    repo.updateProgress(id, currentPage);
    notifyUpserted(id);
  });

  handle(
    LIBRARY_CHANNELS.updateRating,
    args(idArg, (rating) => expectInteger(rating, 'rating', 0, 5)),
    (_event, id, rating) => {
      repo.updateRating(id, rating);
      notifyUpserted(id);
    },
  );

  handle(
    LIBRARY_CHANNELS.updateTags,
    args(idArg, (tags) => expectStringArray(tags, 'tags')),
    (_event, id, tags) => {
      repo.updateTags(id, tags);
      notifyUpserted(id);
    },
  );

  // Generated on the spot when missing: books added before thumbnails existed, or by an import
  // whose rebuild hasn't reached them yet.
  handle(LIBRARY_CHANNELS.thumbnail, args(idArg), (_event, id) => {
    const entry = repo.get(id);
    return entry ? decoder.thumbnail(entry.path).catch(() => null) : null;
  });

  handle(LIBRARY_CHANNELS.imageScanStatus, args(), () => imageScanner.status());

  handle(LIBRARY_CHANNELS.updateMetadata, args(idArg, expectMetadataUpdate), (_event, id, update) => {
    const updated = repo.updateMetadata(id, update);
    if (updated) notify({ scope: 'library', upserted: [updated] });
    return updated;
  });
}
