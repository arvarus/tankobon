/**
 * The network lookups a window has under way, so it can stop them.
 * @module
 */

/**
 * Remembers, per owner (a window, by its `webContents` id), the lookup it is waiting for as an
 * `AbortController`. A window waits for one lookup at a time: starting another gives up the previous
 * one, since the renderer ignores its answer anyway.
 */
export class PendingRequests {
  private readonly byOwner = new Map<number, AbortController>();

  /** Starts a lookup for `owner`, aborting the one it had; returns the signal to give to the requests. */
  begin(owner: number): AbortSignal {
    this.cancel(owner);
    const controller = new AbortController();
    this.byOwner.set(owner, controller);
    return controller.signal;
  }

  /** Marks the lookup of `signal` as finished, unless it was replaced meanwhile. */
  end(owner: number, signal: AbortSignal): void {
    if (this.byOwner.get(owner)?.signal === signal) {
      this.byOwner.delete(owner);
    }
  }

  /** Aborts the lookup `owner` is waiting for, if any. */
  cancel(owner: number): void {
    this.byOwner.get(owner)?.abort();
    this.byOwner.delete(owner);
  }
}
