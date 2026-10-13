/**
 * A small least-recently-used cache.
 * @module
 */

/** A cache that keeps at most a fixed number of entries, dropping the one used least recently. */
export interface LruCache<V> {
  /** The value for `key`, which then counts as the most recently used; undefined when absent. */
  get(key: string): V | undefined;
  /** Stores `value` under `key` as the most recently used, dropping the least recently used entry beyond the capacity. */
  put(key: string, value: V): void;
  /** Number of entries held. */
  readonly size: number;
}

/** Builds an empty {@link LruCache} holding at most `capacity` entries. */
export function createLruCache<V>(capacity: number): LruCache<V> {
  // A Map iterates in insertion order: the first key is the least recently used.
  const entries = new Map<string, V>();
  return {
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key) as V;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    put(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > capacity) {
        entries.delete(entries.keys().next().value as string);
      }
    },
    get size() {
      return entries.size;
    },
  };
}
