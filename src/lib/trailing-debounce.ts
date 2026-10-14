/**
 * A debounce that can be flushed, for values that must not be lost when their producer goes away.
 * @module
 */

/** A pending call of `run`, delayed until the values stop coming. */
export interface TrailingDebounce<T> {
  /** Replaces the pending value and restarts the delay. */
  schedule(value: T): void;
  /** Runs the pending call now, if there is one. */
  flush(): void;
  /** Drops the pending call. */
  cancel(): void;
}

/**
 * Calls `run` with the last value given to `schedule()` once `delayMs` passed without another one.
 * `flush()` runs it at once: the reader's close must save the page it is on, not the one it was
 * on 400 ms earlier.
 */
export function createTrailingDebounce<T>(run: (value: T) => void, delayMs: number): TrailingDebounce<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const call = pending;
    pending = null;
    if (call) run(call.value);
  };

  return {
    schedule(value) {
      if (timer !== null) clearTimeout(timer);
      pending = { value };
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
