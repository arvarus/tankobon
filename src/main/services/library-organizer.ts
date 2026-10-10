/**
 * Library organization: moves the comics of the library into a folder whose layout the app manages,
 * one subfolder per comic.
 * @module
 */
import { constants } from 'node:fs';
import { copyFile, mkdir, rename, rmdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import type { LibraryOrganization } from '../../shared/settings';
import type { LibraryRepository } from '../db/library-repository';
import { isInside } from './library-sync';

/**
 * Longest file or folder name, in UTF-8 bytes: 255 on Linux (ext4…) and macOS (APFS). Windows (NTFS)
 * counts 255 UTF-16 units, never more than the UTF-8 bytes, so the limit holds there too.
 */
export const MAX_NAME_BYTES = 255;

/** Drops whole characters from the end of `text` until it fits in `maxBytes` UTF-8 bytes (a surrogate pair is never split). */
function truncateToBytes(text: string, maxBytes: number): string {
  let bytes = 0;
  let result = '';
  for (const char of text) {
    bytes += Buffer.byteLength(char);
    if (bytes > maxBytes) break;
    result += char;
  }
  return result;
}

/**
 * Name of the subfolder that holds a comic in the organized folder: the original file name without
 * its extension, then the library id in parentheses (`Astérix T01 (3f2a…)`), so two files of the same
 * name never collide. The name part is cut when the whole would exceed {@link MAX_NAME_BYTES}, and a
 * cut name loses its trailing spaces and dots (Windows refuses a name ending with them).
 */
export function organizedFolderName(filePath: string, id: string): string {
  const name = path.basename(filePath, path.extname(filePath));
  const suffix = ` (${id})`;
  const room = MAX_NAME_BYTES - Buffer.byteLength(suffix);
  const kept = Buffer.byteLength(name) > room ? truncateToBytes(name, room).replace(/[\s.]+$/, '') : name;
  return kept === '' ? `(${id})` : `${kept}${suffix}`;
}

/** Where the organization puts a comic: `<root>/<organizedFolderName>/<original file name>`. */
export function organizedPath(root: string, filePath: string, id: string): string {
  return path.join(root, organizedFolderName(filePath, id), path.basename(filePath));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves a file, creating the destination's folder. Refuses to overwrite an existing destination. A
 * move to another drive (`EXDEV`, which `rename` can't do) copies then deletes the original; if
 * the original can't be deleted (a file in use on Windows), the copy is deleted and the move fails,
 * so the file is never left in two places.
 */
export async function moveFile(from: string, to: string): Promise<void> {
  if (await exists(to)) {
    throw Object.assign(new Error(`${to} already exists`), { code: 'EEXIST' });
  }
  const folder = path.dirname(to);
  await mkdir(folder, { recursive: true });
  try {
    try {
      await rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await copyFile(from, to, constants.COPYFILE_EXCL);
      try {
        await unlink(from);
      } catch (unlinkError) {
        await unlink(to).catch(() => undefined);
        throw unlinkError;
      }
    }
  } catch (error) {
    // The folder made for the move goes too, when it is still empty.
    await rmdir(folder).catch(() => undefined);
    throw error;
  }
}

/** A comic the organization moved. */
export interface MovedEntry {
  id: string;
  from: string;
  to: string;
}

/** What {@link organizeEntries} did. */
export interface OrganizeSummary {
  /** The comics moved, with their old and new path. */
  moved: MovedEntry[];
  /** Comics whose move failed (file in use, missing, destination taken…); they stay where they were. */
  failed: number;
}

/**
 * Moves each entry's file to its {@link organizedPath} under `root` and points the entry at it, one
 * after the other. An entry already in place, or no longer in the library, is skipped. A failure
 * only costs that comic. When a comic leaves a subfolder of `root` (one dropped there by hand), that
 * subfolder is deleted if it is now empty; nothing outside `root` is ever deleted.
 */
export async function organizeEntries(
  repo: LibraryRepository,
  root: string,
  ids: string[],
  onProgress: (processed: number, total: number, currentFile: string) => void = () => undefined,
): Promise<OrganizeSummary> {
  const summary: OrganizeSummary = { moved: [], failed: 0 };
  for (const [index, id] of ids.entries()) {
    const entry = repo.get(id);
    if (entry) onProgress(index, ids.length, entry.path);
    if (!entry) continue;
    const to = organizedPath(root, entry.path, entry.id);
    if (to === entry.path) continue;
    if (repo.hasPath(to)) {
      summary.failed += 1;
      continue;
    }
    try {
      await moveFile(entry.path, to);
    } catch {
      summary.failed += 1;
      continue;
    }
    if (!repo.updatePath(id, to)) {
      // The database refused the new path: the file goes back where the entry says it is.
      await moveFile(to, entry.path).catch(() => undefined);
      summary.failed += 1;
      continue;
    }
    summary.moved.push({ id, from: entry.path, to });
    const previousFolder = path.dirname(entry.path);
    if (isInside(root, previousFolder)) await rmdir(previousFolder).catch(() => undefined);
  }
  return summary;
}

/** Ids of the library entries whose file isn't at its {@link organizedPath} under `root` yet, in library order. */
export function unorganizedIds(repo: LibraryRepository, root: string): string[] {
  return repo
    .list()
    .filter((entry) => organizedPath(root, entry.path, entry.id) !== entry.path)
    .map((entry) => entry.id);
}

/** The comics to move now and those to offer to move, as decided by {@link planOrganization}. */
export interface OrganizationPlan {
  now: string[];
  offer: string[];
}

/**
 * Decides what happens to the comics an addition brought in: nothing when the organization is `off`
 * or has no folder; with `always`, they all move now; with `ask`, those found inside the organized
 * folder (added there by hand) move now and the others are offered.
 */
export function planOrganization(
  mode: LibraryOrganization,
  root: string,
  added: { id: string; path: string }[],
): OrganizationPlan {
  if (mode === 'off' || root === '') return { now: [], offer: [] };
  if (mode === 'always') return { now: added.map((entry) => entry.id), offer: [] };
  const now: string[] = [];
  const offer: string[] = [];
  for (const entry of added) (isInside(root, entry.path) ? now : offer).push(entry.id);
  return { now, offer };
}
