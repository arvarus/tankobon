/**
 * The cover thumbnail kept next to a comic, like its `.nfo`: same name, `.cover.webp` extension. It
 * travels with the file, so a library folder shared between machines (a synced drive) carries its
 * covers and no machine has to open every archive to draw them.
 * @module
 */
import path from 'node:path';

/** Suffix that replaces the comic's extension. */
export const COVER_SIDECAR_SUFFIX = '.cover.webp';

/** Where the cover of the comic at `filePath` is kept: beside it, `<name>.cover.webp`. */
export function coverSidecarPath(filePath: string): string {
  const { dir, name } = path.parse(filePath);
  return path.join(dir, name + COVER_SIDECAR_SUFFIX);
}
