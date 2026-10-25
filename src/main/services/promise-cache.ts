/**
 * Remembers the answer of a request for a while, so asking the same thing again costs no request.
 * @module
 */

/** A cache of promises by key. */
export interface PromiseCache<T> {
  /** The remembered answer for `key` while it is fresh, else the result of `compute()`, which is then remembered. */
  get(key: string, compute: () => Promise<T>): Promise<T>;
  /** Forgets everything. */
  clear(): void;
}

/**
 * A cache keeping each answer for `ttlMs` and the `max` most recently asked keys. The promise is
 * stored, not its value, so two callers asking at once share one request; a request that fails (or
 * is cancelled) is forgotten at once, so a failure is never served again. `now` is replaced by the tests.
 */
export function createPromiseCache<T>(ttlMs: number, max: number, now: () => number = Date.now): PromiseCache<T> {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key, compute) {
      const known = entries.get(key);
      if (known && now() - known.at < ttlMs) {
        return known.value;
      }
      const value = compute();
      const entry = { at: now(), value };
      entries.delete(key);
      entries.set(key, entry);
      // A Map iterates in insertion order: the first key is the oldest.
      if (entries.size > max) {
        entries.delete(entries.keys().next().value as string);
      }
      value.catch(() => {
        if (entries.get(key) === entry) {
          entries.delete(key);
        }
      });
      return value;
    },
    clear: () => entries.clear(),
  };
}
