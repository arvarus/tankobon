/**
 * Which window opened which archive, so a window that goes away takes its archives with it.
 * @module
 */

/**
 * Remembers the archives each owner (a window, by its `webContents` id) opened in the decoder
 * process. A renderer that crashes or is closed without closing its book would otherwise leave the
 * archive open until the app quits.
 */
export class ArchiveOwners {
  private readonly byOwner = new Map<number, Set<string>>();

  /** Records that `owner` opened the archive `archiveId`. */
  add(owner: number, archiveId: string): void {
    const archives = this.byOwner.get(owner) ?? new Set<string>();
    archives.add(archiveId);
    this.byOwner.set(owner, archives);
  }

  /** Forgets an archive that was closed; does nothing for an unknown one. */
  remove(archiveId: string): void {
    for (const [owner, archives] of this.byOwner) {
      if (archives.delete(archiveId) && archives.size === 0) {
        this.byOwner.delete(owner);
      }
    }
  }

  /** Forgets `owner` and returns the archives it still had open. */
  release(owner: number): string[] {
    const archives = [...(this.byOwner.get(owner) ?? [])];
    this.byOwner.delete(owner);
    return archives;
  }
}
