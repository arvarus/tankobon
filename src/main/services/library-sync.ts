/**
 * Resynchronizes the library with the folders it was built from: new comics are added, comics whose
 * file is gone are removed.
 * @module
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';

import type { ScanProgress } from '../../shared/library';
import type { ArchiveSummary } from '../decoder/protocol';
import type { LibraryRepository } from '../db/library-repository';
import { collectComicFiles, scanIntoLibrary } from './library-scanner';

/** What `resyncLibrary` did. */
export interface ResyncSummary {
  /** Comics added to the library. */
  added: number;
  /** Library entries removed because their file no longer exists. */
  removed: number;
  /** Files that couldn't be opened. */
  failed: number;
  /** Folders that couldn't be read (missing, unplugged drive): left alone, nothing removed from them. */
  unreachable: number;
  /** The entries added, for the library organization. */
  addedEntries: { id: string; path: string }[];
  /** Ids of the removed entries and the path of their file, for the caller's follow-up (thumbnails, notifications). */
  removedEntries: { id: string; path: string }[];
}

/** Whether `filePath` is inside `directory` (not the directory itself). */
export function isInside(directory: string, filePath: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function isReadableDirectory(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

/** True only when the file is certainly gone (ENOENT): any other error (permissions, I/O) keeps the entry. */
async function isMissing(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

/**
 * Walks every folder again: new comics are added (as a folder scan does), then the entries under
 * that folder whose file no longer exists are removed, with their credits and reading-list places.
 * Safety rules, because a removal loses the user's progress, rating and tags: a folder that can't
 * be read as a directory is skipped entirely (an unplugged drive must not empty the library), and an
 * entry goes only when `stat` says the file is gone (`ENOENT`), not merely absent from the walk,
 * which skips the subfolders it can't read. Entries outside every folder (a file added on its own)
 * are checked one by one afterwards: they go when their file is gone and the directory that held it
 * is still readable, so a vanished drive or folder keeps them. The files on disk are never touched.
 */
export async function resyncLibrary(
  repo: LibraryRepository,
  folders: string[],
  onProgress: (progress: ScanProgress) => void,
  inspect: (filePath: string) => Promise<ArchiveSummary>,
): Promise<ResyncSummary> {
  const summary: ResyncSummary = { added: 0, removed: 0, failed: 0, unreachable: 0, removedEntries: [], addedEntries: [] };
  // Each folder reports its own `done`; the caller only wants the one after the last.
  const forward = (progress: ScanProgress) => {
    if (progress.phase !== 'done') onProgress(progress);
  };

  for (const folder of folders) {
    if (!(await isReadableDirectory(folder))) {
      summary.unreachable += 1;
      continue;
    }

    const scanned = await scanIntoLibrary(repo, folder, forward, inspect);
    summary.added += scanned.added;
    summary.failed += scanned.failed;
    summary.addedEntries.push(...scanned.addedEntries);

    const found = new Set(await collectComicFiles(folder));
    for (const entry of repo.list()) {
      if (found.has(entry.path) || !isInside(folder, entry.path)) continue;
      if (await isMissing(entry.path)) {
        repo.remove(entry.id);
        summary.removed += 1;
        summary.removedEntries.push({ id: entry.id, path: entry.path });
      }
    }
  }

  for (const entry of repo.list()) {
    if (folders.some((folder) => isInside(folder, entry.path))) continue;
    if ((await isMissing(entry.path)) && (await isReadableDirectory(path.dirname(entry.path)))) {
      repo.remove(entry.id);
      summary.removed += 1;
      summary.removedEntries.push({ id: entry.id, path: entry.path });
    }
  }

  onProgress({ phase: 'done', processed: 0, total: 0, currentFile: '' });
  return summary;
}
