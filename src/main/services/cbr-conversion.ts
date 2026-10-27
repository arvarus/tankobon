/**
 * Converting the CBR of the organized library to CBZ. A RAR can't be rewritten, so the books in that
 * format miss the options that edit the archive (cleaning…). Each CBR of the organized folder is
 * written as a CBZ beside it, the entry follows (same id: progress, rating, tags and lists are kept)
 * and the CBR goes to `.deletedByTankobon` at the root of the organized folder, from where the user
 * empties it when they want. Kept out of the IPC layer, which only calls it, so it runs under Vitest.
 * @module
 */
import { lstat, readdir, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { comicFormat } from '../../shared/comic';
import {
  DELETED_BY_TANKOBON_FOLDER,
  type ConvertCbrResult,
  type ConvertCountResult,
  type EmptyDeletedResult,
  type ScanProgress,
} from '../../shared/library';
import type { LibraryRepository } from '../db/library-repository';
import type { SettingsRepository } from '../db/settings-repository';
import { isInside } from '../path-containment';
import type { ConvertedArchive } from './cbr-converter';
import { coverSidecarPath } from './cover-sidecar';
import { moveFile } from './library-organizer';
import type { LibraryNotifier, LibraryRunLock } from './library-organization';
import { nfoPathFor } from './nfo';
import { firstFreeName, organizedFolderProblem } from './organized-folder';

/** The part of the decoder process the conversion calls. */
export interface ConversionDecoder {
  /** Writes a CBR as a CBZ, checked before it appears. */
  convertCbr(cbrPath: string, cbzPath: string): Promise<ConvertedArchive>;
  /** Deletes a book's cached thumbnail. */
  removeThumbnail(filePath: string): Promise<void>;
}

/** The conversion as the handlers use it; built once in `main.ts`. */
export interface CbrConverter {
  /** How many CBR of the organized folder can be converted, and what `.deletedByTankobon` holds. An error when the organization is off or its folder unreachable. */
  count(): Promise<ConvertCountResult>;
  /** Converts them one at a time, reporting each through `onProgress`. Holds the shared lock. */
  convert(onProgress?: (progress: ScanProgress) => void): Promise<ConvertCbrResult>;
  /** Deletes everything in `.deletedByTankobon` for good. Holds the shared lock. */
  emptyDeleted(): Promise<EmptyDeletedResult>;
}

/** Total size of a file, or of everything under a folder (the orphan folders are parked whole); 0 when unreadable. Links are not followed. */
async function sizeOf(target: string): Promise<number> {
  const info = await lstat(target).catch(() => null);
  if (!info) return 0;
  if (!info.isDirectory()) return info.size;
  let bytes = 0;
  for (const name of await readdir(target).catch(() => [] as string[])) bytes += await sizeOf(path.join(target, name));
  return bytes;
}

/** What is at the top of `folder` (files from the conversion, folders from the orphan cleaning) and the total size; both 0 when it doesn't exist. */
async function folderContents(folder: string): Promise<{ names: string[]; bytes: number }> {
  const names = await readdir(folder).catch(() => [] as string[]);
  let bytes = 0;
  for (const name of names) bytes += await sizeOf(path.join(folder, name));
  return { names, bytes };
}

/** Builds the converter around the library and the decoder; `lock` is the one shared with the other runs over the files. */
export function createCbrConverter(
  repo: LibraryRepository,
  settings: SettingsRepository,
  decoder: ConversionDecoder,
  notify: LibraryNotifier,
  lock: LibraryRunLock,
): CbrConverter {
  /** The organized folder when the organization is on and the folder is there, else the error to return. */
  const usableRoot = async (): Promise<{ root: string } | { status: 'error'; message: string }> => {
    const { libraryOrganization: mode, libraryOrganizationFolder: root } = settings.getAll();
    const problem = await organizedFolderProblem(mode, root);
    return problem === null ? { root } : { status: 'error', message: problem };
  };

  const convertibleIds = (root: string) =>
    repo
      .list()
      .filter((entry) => comicFormat(entry.path) === 'CBR' && isInside(root, entry.path))
      .map((entry) => entry.id);

  return {
    async count() {
      const usable = await usableRoot();
      if (!('root' in usable)) return usable;
      const deleted = await folderContents(path.join(usable.root, DELETED_BY_TANKOBON_FOLDER));
      return {
        status: 'ok',
        count: convertibleIds(usable.root).length,
        folder: usable.root,
        deletedFiles: deleted.names.length,
        deletedBytes: deleted.bytes,
      };
    },

    async convert(onProgress = () => undefined) {
      const usable = await usableRoot();
      if (!('root' in usable)) return usable;
      if (!lock.tryStart('convert')) return { status: 'error', message: lock.busyMessage() };
      const { root } = usable;
      const trash = path.join(root, DELETED_BY_TANKOBON_FOLDER);
      const result = { converted: 0, failed: 0 };
      try {
        const ids = convertibleIds(root);
        for (const [index, id] of ids.entries()) {
          const entry = repo.get(id);
          if (!entry) continue;
          const from = entry.path;
          onProgress({ phase: 'importing', processed: index, total: ids.length, currentFile: from });
          const stem = path.basename(from, path.extname(from));
          let to: string | null = null;
          // Once the entry names the CBZ, that file is the book: a later hiccup must not delete it.
          let committed = false;
          try {
            to = await firstFreeName(path.dirname(from), stem, '.cbz', (candidate) => !repo.hasPath(candidate));
            const { fileCount } = await decoder.convertCbr(from, to);
            // The CBR leaves the library folders for good only once the CBZ exists and was checked.
            const parked = await firstFreeName(trash, path.basename(from, path.extname(from)), path.extname(from), () => true);
            await moveFile(from, parked);
            if (!repo.updatePath(id, to)) {
              // The database refused: the CBR goes back where the entry says it is.
              await moveFile(parked, from).catch(() => undefined);
              throw new Error('path refused');
            }
            committed = true;
            repo.updateFileStats(id, fileCount, await stat(to).then((s) => s.size, () => 0));
            // The cover kept beside the comic and its `.nfo` follow it (best effort, regenerated when missing).
            await moveFile(coverSidecarPath(from), coverSidecarPath(to)).catch(() => undefined);
            await moveFile(nfoPathFor(from), nfoPathFor(to)).catch(() => undefined);
            await decoder.removeThumbnail(from).catch(() => undefined);
            result.converted++;
          } catch {
            // Before the entry was pointed at the CBZ, nothing half-done is left: it still names the CBR, where it was.
            if (to && !committed) await rm(to, { force: true }).catch(() => undefined);
            result.failed++;
          }
        }
        if (result.converted > 0) notify({ scope: 'library' });
        return { status: 'ok', ...result };
      } finally {
        onProgress({ phase: 'done', processed: 0, total: 0, currentFile: '' });
        lock.end();
      }
    },

    async emptyDeleted() {
      const usable = await usableRoot();
      if (!('root' in usable)) return usable;
      if (!lock.tryStart('convert')) return { status: 'error', message: lock.busyMessage() };
      try {
        const folder = path.join(usable.root, DELETED_BY_TANKOBON_FOLDER);
        const { names } = await folderContents(folder);
        const result = { deleted: 0, bytesFreed: 0, failed: 0 };
        for (const name of names) {
          const file = path.join(folder, name);
          const size = await sizeOf(file);
          try {
            await rm(file, { recursive: true });
            result.deleted++;
            result.bytesFreed += size;
          } catch {
            result.failed++;
          }
        }
        await rmdir(folder).catch(() => undefined);
        return { status: 'ok', ...result };
      } finally {
        lock.end();
      }
    },
  };
}
