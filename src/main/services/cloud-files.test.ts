import { describe, expect, it, vi } from 'vitest';

import { isOnlineOnly, isOnlineOnlyOutput, withTtlCache } from './cloud-files';

const FILE = 'C:\\OneDrive\\BD\\Tintin T01.cbz';

describe('isOnlineOnlyOutput', () => {
  it('flags an unpinned or offline file', () => {
    expect(isOnlineOnlyOutput(`     U            ${FILE}\r\n`, FILE)).toBe(true);
    expect(isOnlineOnlyOutput(`A    O            ${FILE}\r\n`, FILE)).toBe(true);
  });

  it('keeps a file that is on disk', () => {
    expect(isOnlineOnlyOutput(`A                ${FILE}\r\n`, FILE)).toBe(false);
    expect(isOnlineOnlyOutput(`A    P            ${FILE}\r\n`, FILE)).toBe(false);
  });

  it('does not take letters of the path for flags', () => {
    expect(isOnlineOnlyOutput(`A   ${FILE}`, FILE)).toBe(false);
  });
});

describe('isOnlineOnly', () => {
  it('only checks on Windows', async () => {
    const run = async () => `U   ${FILE}`;
    expect(await isOnlineOnly(FILE, 'linux', run)).toBe(false);
    expect(await isOnlineOnly(FILE, 'win32', run)).toBe(true);
  });

  it('counts a failed check as a local file', async () => {
    expect(await isOnlineOnly(FILE, 'win32', async () => Promise.reject(new Error('no attrib')))).toBe(false);
  });
});

describe('withTtlCache', () => {
  it('answers a repeated key from memory until its time is up', async () => {
    let clock = 0;
    const compute = vi.fn(async (key: string) => key.length);
    const cached = withTtlCache(compute, 1000, () => clock);

    expect(await cached('abc')).toBe(3);
    expect(await cached('abc')).toBe(3);
    expect(compute).toHaveBeenCalledTimes(1);

    clock = 1000;
    await cached('abc');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps one answer per key and forgets the oldest past its size', async () => {
    const compute = vi.fn(async (key: string) => key);
    const cached = withTtlCache(compute, 1000, () => 0, 2);

    await cached('a');
    await cached('b');
    await cached('c'); // pushes 'a' out
    await cached('b');
    expect(compute).toHaveBeenCalledTimes(3);
    await cached('a');
    expect(compute).toHaveBeenCalledTimes(4);
  });
});
