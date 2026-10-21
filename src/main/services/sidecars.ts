/**
 * The files kept beside a comic (its cover and its `.nfo`), which follow it when it goes.
 * @module
 */
import { stat } from 'node:fs/promises';

import { coverSidecarPath } from './cover-sidecar';
import { nfoPathFor } from './nfo';

/**
 * Sends the sidecars of `comicPath` that exist (`<name>.cover.webp`, `<name>.nfo`) through `trash` (the
 * OS trash, so that it can be undone). One that can't be trashed is left: the comic itself is what counts.
 */
export async function trashSidecars(comicPath: string, trash: (filePath: string) => Promise<void>): Promise<void> {
  for (const sidecar of [coverSidecarPath(comicPath), nfoPathFor(comicPath)]) {
    if (await stat(sidecar).catch(() => null)) await trash(sidecar).catch(() => undefined);
  }
}
