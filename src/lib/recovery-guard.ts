/**
 * Lets the reader reopen a book that stopped answering (the decoder process restarted and forgot the
 * archive) once, and not again until a page has been read: a book that really can't be read must show its
 * error, not reopen itself forever.
 * @module
 */

/** One automatic reopening at a time. */
export interface RecoveryGuard {
  /** Whether a reopening may start now; true at most once until {@link RecoveryGuard.succeeded}. */
  tryRecover(): boolean;
  /** A page was read: the next failure may be recovered again. */
  succeeded(): void;
}

/** A fresh {@link RecoveryGuard}, allowing one reopening. */
export function createRecoveryGuard(): RecoveryGuard {
  let used = false;
  return {
    tryRecover() {
      if (used) return false;
      used = true;
      return true;
    },
    succeeded() {
      used = false;
    },
  };
}
