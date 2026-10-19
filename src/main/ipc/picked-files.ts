import { randomUUID } from 'node:crypto';

/** How many picks are remembered; an older token expires. */
const MAX_PICKED_PATHS = 20;

/**
 * The files the user chose outside the library (the open dialog, the file explorer), by the opaque
 * token handed to the renderer. With the library's books (by id), they are the only things
 * `comic:open` accepts: the renderer never names a path, so it can't have the main process read an
 * arbitrary file. Only the most recent picks are kept: a token is used right after the pick.
 */
export class PickedFiles {
  private readonly picks = new Map<string, { path: string; addToLibrary: boolean }>();

  /** Remembers `path` and returns its token. `addToLibrary` makes `comic:open` add the book whatever the setting says. */
  add(path: string, addToLibrary: boolean): string {
    const token = randomUUID();
    this.picks.set(token, { path, addToLibrary });
    for (const oldest of this.picks.keys()) {
      if (this.picks.size <= MAX_PICKED_PATHS) break;
      this.picks.delete(oldest);
    }
    return token;
  }

  /** The pick a token stands for, or `undefined`. */
  get(token: string): { path: string; addToLibrary: boolean } | undefined {
    return this.picks.get(token);
  }
}
