/**
 * A value that follows another one once it has stopped changing.
 * @module
 */
import { useEffect, useState } from 'react';

/**
 * `value`, but only after it has stayed the same for `delayMs`: while it keeps changing, the previous
 * settled value is returned. For work that depends on a value changing at every page turn (the whole
 * library is replaced by each progress save) but doesn't have to follow it that closely.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
