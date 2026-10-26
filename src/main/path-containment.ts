/**
 * Whether a path is inside a folder: the one definition the library uses (resynchronization, organization,
 * CBR conversion, library roots), so that a name starting with two dots is judged the same everywhere.
 * @module
 */
import path from 'node:path';

/**
 * Whether `relative` (a result of `path.relative()`) is outside the folder it is relative to. Only a `..`
 * segment leaves it: a name that merely starts with two dots (`...Et alors.cbz`) is inside.
 */
export function leavesFolder(relative: string): boolean {
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

/** Whether `filePath` is inside `directory` (not the directory itself). */
export function isInside(directory: string, filePath: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '' && !leavesFolder(relative);
}
