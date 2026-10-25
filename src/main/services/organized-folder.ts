/**
 * What the runs over the organized folder (organization, CBR conversion, orphan folders) share: whether
 * the folder can be used, and the names free in a folder. Free of Electron, like those services.
 * @module
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { t } from '../../shared/i18n';
import type { LibraryOrganization } from '../../shared/settings';

/** Whether `file` exists (any error counts as no). */
export async function pathExists(file: string): Promise<boolean> {
  return stat(file).then(() => true, () => false);
}

/** Whether `folder` exists and is a directory. */
export async function isDirectory(folder: string): Promise<boolean> {
  return stat(folder).then((info) => info.isDirectory(), () => false);
}

/**
 * Why the organized folder `root` can't be used for a run, as a message in the interface language, or `null`
 * when it can: the organization is `off` or has no folder, or the folder isn't there (an unplugged drive).
 */
export async function organizedFolderProblem(mode: LibraryOrganization, root: string): Promise<string | null> {
  if (mode === 'off' || root === '') return t('errors:library.organizationOff');
  if (!(await isDirectory(root))) return t('errors:library.organizationFolderUnreachable', { folder: root });
  return null;
}

/**
 * The first of `stem.ext`, `stem (2).ext`, `stem (3).ext`… in `folder` that `isFree` accepts and that doesn't
 * exist on disk. `extension` is empty for a folder name.
 */
export async function firstFreeName(
  folder: string,
  stem: string,
  extension = '',
  isFree: (candidate: string) => boolean = () => true,
): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = path.join(folder, n === 1 ? `${stem}${extension}` : `${stem} (${n})${extension}`);
    if (isFree(candidate) && !(await pathExists(candidate))) return candidate;
  }
}
