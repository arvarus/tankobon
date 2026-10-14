import { randomUUID } from 'node:crypto';
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
import { existingDirectory, openDialogFor } from './dialogs';
import { handle } from './handle';
import { args, booleanArg, idArg, pageIndexArg } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const COMIC_CHANNELS = {
  pickFile: 'comic:pick-file',
  open: 'comic:open',
  readPage: 'comic:read-page',
  close: 'comic:close',
} as const;

/** How many file-dialog picks `comic:open` remembers; an older token expires. */
const MAX_PICKED_PATHS = 20;

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
): void {
  // The files the user picked in the open dialog, by the opaque token `comic:pick-file` returned,
  // with whether the pick came from the library's "add a file" (such a book is always added).
  // With the library's books (by id), they are the only things `comic:open` accepts: the renderer
  // never names a path, so it can't have the main process read an arbitrary file.
  // Only the most recent picks are kept: a token is used right after the dialog, never much later.
  const pickedPaths = new Map<string, { path: string; addToLibrary: boolean }>();

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
    const token = randomUUID();
    pickedPaths.set(token, { path: filePaths[0], addToLibrary });
    for (const oldest of pickedPaths.keys()) {
      if (pickedPaths.size <= MAX_PICKED_PATHS) break;
      pickedPaths.delete(oldest);
    }
    return token;
  });

  handle(COMIC_CHANNELS.open, args(idArg), async (_event, ref): Promise<OpenComicResult> => {
    // A dialog token, else a library entry id; anything else is not a book we know.
    const picked = pickedPaths.get(ref);
    const filePath = picked?.path ?? libraryRepo.get(ref)?.path;
    if (!filePath) {
      return { status: 'error', message: t('errors:archive.unknownBook') };
    }
    let comic: ArchiveInfo | undefined;
    try {
      comic = await decoder.open(filePath);
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
      if (comic) void decoder.close(comic.id).catch(() => undefined);
      return { status: 'error', message: openErrorMessage(error) };
    }
  });

  handle(COMIC_CHANNELS.readPage, args(idArg, pageIndexArg), (_event, id, index) => decoder.readPage(id, index));

  handle(COMIC_CHANNELS.close, args(idArg), (_event, id) => decoder.close(id));
}
