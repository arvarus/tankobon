import { describe, expect, it } from 'vitest';

import { createLruCache } from './lru-cache';

describe('createLruCache', () => {
  it('returns what was stored, and undefined for the rest', () => {
    const cache = createLruCache<string>(2);
    cache.put('a', '1');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  it('drops the least recently used entry beyond its capacity', () => {
    const cache = createLruCache<string>(2);
    cache.put('a', '1');
    cache.put('b', '2');
    cache.put('c', '3');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  it('counts a read as a use', () => {
    const cache = createLruCache<string>(2);
    cache.put('a', '1');
    cache.put('b', '2');
    cache.get('a');
    cache.put('c', '3');

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
  });

  it('replaces a value without growing', () => {
    const cache = createLruCache<string>(2);
    cache.put('a', '1');
    cache.put('a', '2');

    expect(cache.get('a')).toBe('2');
    expect(cache.size).toBe(1);
  });
});
