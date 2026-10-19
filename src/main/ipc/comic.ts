import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

import { SUPPORTED_COMIC_EXTENSIONS, type ArchiveInfo, type OpenComicResult } from '../../shared/comic';
import { t } from '../../shared/i18n';
import type { LibraryRepository } from '../db/library-repository';
import type { SettingsRepository } from '../db/settings-repository';
import type { DecoderClient } from '../decoder/decoder-client';
import type { ImageStatsScanner } from '../services/image-stats-scanner';
import { openErrorMessage } from '../services/open-error';
import type { NotifyDataChange } from './data-changes';
import { ArchiveOwners } from './archive-owners';
import { existingDirectory, openDialogFor } from './dialogs';
import { handle } from './handle';
import { PickedFiles } from './picked-files';
import { args, booleanArg, idArg, pageIndexArg } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const COMIC_CHANNELS = {
  pickFile: 'comic:pick-file',
  open: 'comic:open',
  readPage: 'comic:read-page',
  close: 'comic:close',
} as const;

/** Directory of the last comic opened, so the file dialogs pick up where the user left off. */
export function lastOpenedDirectory(libraryRepo: LibraryRepository): Promise<string | undefined> {
  const lastPath = libraryRepo.lastOpenedPath();
  return existingDirectory(lastPath && dirname(lastPath));
}

export function registerComicIpc(
  libraryRepo: LibraryRepository,
  settingsRepo: SettingsRepository,
  decoder: DecoderClient,
  notify: NotifyDataChange,
  imageScanner: ImageStatsScanner,
  // Shared with the launch files (see LaunchFiles): a file the OS asked to open is opened by token too.
  pickedFiles: PickedFiles = new PickedFiles(),
): void {
  // The archives each window opened: closed when the window is destroyed (a crashed or closed
  // renderer never calls `comic:close`).
  const owners = new ArchiveOwners();
  const watchedSenders = new Set<number>();

  handle(COMIC_CHANNELS.pickFile, args(booleanArg), async (event, addToLibrary) => {
    const options: Electron.OpenDialogOptions = {
      title: t('dialogs:openComic'),
      properties: ['openFile'],
      filters: [{ name: t('dialogs:comicFiles'), extensions: [...SUPPORTED_COMIC_EXTENSIONS] }],
      defaultPath: await lastOpenedDirectory(libraryRepo),
    };
    const { canceled, filePaths } = await openDialogFor(event, options);
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return pickedFiles.add(filePaths[0], addToLibrary);
  });

  handle(COMIC_CHANNELS.open, args(idArg), async (event, ref): Promise<OpenComicResult> => {
    // A dialog token, else a library entry id; anything else is not a book we know.
    const picked = pickedFiles.get(ref);
    const filePath = picked?.path ?? libraryRepo.get(ref)?.path;
    if (!filePath) {
      return { status: 'error', message: t('errors:archive.unknownBook') };
    }
    let comic: ArchiveInfo | undefined;
    try {
      comic = await decoder.open(filePath);
      const sender = event.sender;
      if (!watchedSenders.has(sender.id)) {
        const senderId = sender.id;
        watchedSenders.add(senderId);
        sender.once('destroyed', () => {
          watchedSenders.delete(senderId);
          for (const id of owners.release(senderId)) void decoder.close(id).catch(() => undefined);
        });
      }
      owners.add(sender.id, comic.id);
      // Anonymous read: with the option off, a book the library doesn't know is not added (unless it was
      // picked from the library page's "add a file"), so nothing is saved for it (no entry, no progress, no cover) and it reopens from its first page.
      const anonymous =
        !picked?.addToLibrary && !settingsRepo.getAll().addOpenedBooksToLibrary && !libraryRepo.hasPath(comic.path);
      if (anonymous) {
        return { status: 'ok', comic: { ...comic, libraryId: null, resumePage: 0 } };
      }
      const { size } = await stat(comic.path);
      const entry = libraryRepo.touch(comic.path, comic.title, comic.pageCount, comic.fileCount, size);
      // Opening bumps `lastOpenedAt` (and may refresh the title and page count).
      notify({ scope: 'library', upserted: [entry] });
      // A book new to the library (or never measured) joins the background measure of the pages.
      if (entry.avgPageWidth === null) void imageScanner.kick();
      // In the background, from the archive just opened: opening the book must not wait for its cover.
      if (comic.pageCount > 0) {
        void decoder.thumbnail(comic.path, comic.id).catch(() => undefined);
      }
      // The library title wins over the file name: the user may have set one from a metadata lookup.
      return {
        status: 'ok',
        comic: { ...comic, title: entry.title, libraryId: entry.id, resumePage: entry.currentPage },
      };
    } catch (error) {
      // The archive is open in the decoder process but nobody will ever read it: release it.
      if (comic) {
        owners.remove(comic.id);
        void decoder.close(comic.id).catch(() => undefined);
      }
      return { status: 'error', message: openErrorMessage(error) };
    }
  });

  handle(COMIC_CHANNELS.readPage, args(idArg, pageIndexArg), (_event, id, index) => decoder.readPage(id, index));

  handle(COMIC_CHANNELS.close, args(idArg), (_event, id) => {
    owners.remove(id);
    return decoder.close(id);
  });
}
