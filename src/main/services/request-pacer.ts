/**
 * Spaces the requests sent to one site, so a burst of searches never hammers it.
 * @module
 */

/** Waits for a slot before a request is sent to a site. */
export interface RequestPacer {
  /**
   * Resolves when the caller may send its request: at least the pacer's interval after the previous
   * caller's slot, whoever the callers are. Rejects with the signal's reason if it is aborted while waiting.
   */
  wait(signal?: AbortSignal): Promise<void>;
}

/** What the pacer needs from the outside; the tests replace both. */
export interface PacerClock {
  /** The current time, in milliseconds. */
  now(): number;
  /** Resolves after `ms`, or rejects with the signal's reason when it is aborted first. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

const realClock: PacerClock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
};

/**
 * A pacer letting one request through every `intervalMs` at most. Each caller reserves its slot
 * right away (before it sleeps), so callers that arrive together are spaced out one after another
 * instead of all waking at once; the first request of a quiet period goes through without waiting.
 * A caller that gives up keeps its slot, which only makes the next one wait a little longer.
 */
export function createRequestPacer(intervalMs: number, clock: PacerClock = realClock): RequestPacer {
  let nextSlot = 0;
  return {
    async wait(signal) {
      signal?.throwIfAborted();
      const start = Math.max(clock.now(), nextSlot);
      nextSlot = start + intervalMs;
      const delay = start - clock.now();
      if (delay > 0) {
        await clock.sleep(delay, signal);
      }
    },
  };
}
