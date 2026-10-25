import { describe, expect, it, vi } from 'vitest';

import { createPromiseCache } from './promise-cache';

describe('createPromiseCache', () => {
  it('computes once while the answer is fresh, then again once it is stale', async () => {
    let time = 0;
    const cache = createPromiseCache<string>(1000, 10, () => time);
    const compute = vi.fn(async () => 'answer');
    await cache.get('a', compute);
    time = 999;
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    time = 1000;
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('shares one request between callers asking at once', async () => {
    const cache = createPromiseCache<number>(1000, 10);
    const compute = vi.fn(async () => 1);
    await Promise.all([cache.get('a', compute), cache.get('a', compute)]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('keeps keys apart', async () => {
    const cache = createPromiseCache<string>(1000, 10);
    expect(await cache.get('a', async () => 'A')).toBe('A');
    expect(await cache.get('b', async () => 'B')).toBe('B');
  });

  it('forgets a request that failed', async () => {
    const cache = createPromiseCache<string>(1000, 10);
    await expect(cache.get('a', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    const compute = vi.fn(async () => 'back');
    expect(await cache.get('a', compute)).toBe('back');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('keeps only the most recently asked keys', async () => {
    const cache = createPromiseCache<string>(1000, 2);
    const compute = vi.fn(async () => 'x');
    await cache.get('a', compute);
    await cache.get('b', compute);
    await cache.get('c', compute);
    expect(compute).toHaveBeenCalledTimes(3);
    await cache.get('b', compute);
    await cache.get('c', compute);
    expect(compute).toHaveBeenCalledTimes(3);
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it('forgets everything on clear()', async () => {
    const cache = createPromiseCache<string>(1000, 10);
    const compute = vi.fn(async () => 'x');
    await cache.get('a', compute);
    cache.clear();
    await cache.get('a', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
