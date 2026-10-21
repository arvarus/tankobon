/**
 * Which covers were replaced during this session. Covers aren't part of the data store (they are
 * fetched by `BookCover` as bytes), so a replaced one is announced here: `BookCover` subscribes to its
 * entry's revision and asks for the thumbnail again when it changes.
 * @module
 */
const revisions = new Map<string, number>();
const listeners = new Set<() => void>();

/** Announces that the cover of `entryId` was replaced. */
export function bumpCoverRevision(entryId: string): void {
  revisions.set(entryId, (revisions.get(entryId) ?? 0) + 1);
  for (const listener of listeners) listener();
}

/** How many times the cover of `entryId` was replaced since the window opened (0 when never). */
export function coverRevision(entryId: string): number {
  return revisions.get(entryId) ?? 0;
}

/** Calls `listener` after every replaced cover; returns the function that stops it. */
export function subscribeCoverRevisions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
