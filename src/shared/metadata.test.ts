import { describe, expect, it } from 'vitest';

import { isCoverUrl } from './metadata';

describe('isCoverUrl', () => {
  it('accepts https pictures of the sources\' hosts', () => {
    expect(isCoverUrl('https://comicvine.gamespot.com/a/b.jpg')).toBe(true);
    expect(isCoverUrl('https://books.google.com/books/content?id=1')).toBe(true);
    expect(isCoverUrl('https://www.bedetheque.com/cache/thb_couv/x.jpg')).toBe(true);
    expect(isCoverUrl('https://cdn.bdfugue.com/x.jpg')).toBe(true);
    expect(isCoverUrl('https://www.nautiljon.com/images/x.jpg')).toBe(true);
  });

  it('refuses other hosts, other schemes, look-alikes and credentials', () => {
    expect(isCoverUrl('http://books.google.com/x.jpg')).toBe(false);
    expect(isCoverUrl('https://evil.example/x.jpg')).toBe(false);
    expect(isCoverUrl('https://books.google.com.evil.example/x.jpg')).toBe(false);
    expect(isCoverUrl('https://evilbdfugue.com/x.jpg')).toBe(false);
    expect(isCoverUrl('https://user@books.google.com/x.jpg')).toBe(false);
    expect(isCoverUrl('file:///etc/passwd')).toBe(false);
    expect(isCoverUrl('not a url')).toBe(false);
  });
});
