import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTrailingDebounce } from './trailing-debounce';

describe('createTrailingDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs once with the last value after the delay', () => {
    const run = vi.fn();
    const debounce = createTrailingDebounce(run, 400);

    debounce.schedule(1);
    vi.advanceTimersByTime(300);
    debounce.schedule(2);
    vi.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(2);
  });

  it('flush() runs the pending value at once and only once', () => {
    const run = vi.fn();
    const debounce = createTrailingDebounce(run, 400);

    debounce.schedule(7);
    debounce.flush();
    expect(run).toHaveBeenCalledWith(7);

    vi.advanceTimersByTime(1000);
    debounce.flush();
    expect(run).toHaveBeenCalledOnce();
  });

  it('flush() does nothing when nothing is pending', () => {
    const run = vi.fn();
    createTrailingDebounce(run, 400).flush();
    expect(run).not.toHaveBeenCalled();
  });

  it('cancel() drops the pending value', () => {
    const run = vi.fn();
    const debounce = createTrailingDebounce(run, 400);

    debounce.schedule(3);
    debounce.cancel();
    vi.advanceTimersByTime(1000);
    debounce.flush();
    expect(run).not.toHaveBeenCalled();
  });
});
