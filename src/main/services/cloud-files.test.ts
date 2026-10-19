import { describe, expect, it } from 'vitest';

import { isOnlineOnly, isOnlineOnlyOutput } from './cloud-files';

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
