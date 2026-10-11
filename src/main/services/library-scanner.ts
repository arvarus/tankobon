/**
 * Walks a directory tree for comics and registers everything it finds in the library.
 * @module
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { SUPPORTED_COMIC_EXTENSIONS } from '../../shared/comic';
import type { ScanProgress } from '../../shared/library';
import type { ArchiveSummary } from '../decoder/protocol';
import type { LibraryRepository } from '../db/library-repository';

/** Counts reported at the end of `scanIntoLibrary`. */
export interface ScanSummary {
  added: number;
  skipped: number;
  failed: number;
  total: number;
  /** The entries this scan created, for the library organization. */
  addedEntries: { id: string; path: string }[];
}

/** Whether a file name has one of the `SUPPORTED_COMIC_EXTENSIONS` (case-insensitive). */
export function isSupportedComicFile(fileName: string): boolean {
  const extension = path.extname(fileName).slice(1).toLowerCase();
  return (SUPPORTED_COMIC_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Every supported comic under `directory`, recursively, sorted so a scan walks a series in a
 * predictable order. Directories that can't be read (permissions, a disconnected network share)
 * are skipped rather than failing the whole scan. Symlinks are never followed: `isDirectory()` is
 * false for them, which also rules out cycles.
 */
export async function collectComicFiles(directory: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isSupportedComicFile(entry.name)) {
        found.push(fullPath);
      }
    }
  }

  await walk(directory);
  return found;
}

/**
 * Adds every comic under `directory` to the library. Each file has to be opened to learn its page
 * count — that's the slow part, and why `onProgress` reports file by file. Files already in the
 * library are skipped without being opened, and one unreadable file only costs itself (`failed`),
 * never the rest of the scan. Opening is `inspect`'s job (the decoder process, which also caches the
 * cover): the scanner itself never parses an archive, it only owns the walk and the database.
 */
export async function scanIntoLibrary(
  repo: LibraryRepository,
  directory: string,
  onProgress: (progress: ScanProgress) => void,
  inspect: (filePath: string) => Promise<ArchiveSummary>,
): Promise<ScanSummary> {
  onProgress({ phase: 'scanning', processed: 0, total: 0, currentFile: directory });
  const files = await collectComicFiles(directory);

  const summary: ScanSummary = { added: 0, skipped: 0, failed: 0, total: files.length, addedEntries: [] };

  for (const [index, filePath] of files.entries()) {
    onProgress({ phase: 'importing', processed: index, total: files.length, currentFile: filePath });

    if (repo.hasPath(filePath)) {
      summary.skipped += 1;
      continue;
    }

    try {
      const { pageCount, fileCount } = await inspect(filePath);
      const { size } = await stat(filePath);
      const title = path.basename(filePath, path.extname(filePath));
      repo.register(filePath, title, pageCount, fileCount, size);
      summary.added += 1;
      const id = repo.idOfPath(filePath);
      if (id) summary.addedEntries.push({ id, path: filePath });
    } catch {
      summary.failed += 1;
    }
  }

  onProgress({ phase: 'done', processed: files.length, total: files.length, currentFile: '' });
  return summary;
}
