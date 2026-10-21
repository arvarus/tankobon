import { describe, expect, it } from 'vitest';

import { isValidReleaseDate, validReleaseDate } from './release-date';

describe('isValidReleaseDate', () => {
  it('accepts dates that exist, at any precision', () => {
    for (const date of ['2003', '2003-11', '2004-02-29']) expect(isValidReleaseDate(date)).toBe(true);
  });

  it('refuses what is not a date', () => {
    for (const date of ['03', '2003/11', '2003-13', '2003-00', '2003-02-29', '2003-04-31', '2024-99-99']) {
      expect(isValidReleaseDate(date)).toBe(false);
    }
  });
});

describe('validReleaseDate', () => {
  it('keeps a valid date and cuts a time off', () => {
    expect(validReleaseDate('2012-03-14')).toBe('2012-03-14');
    expect(validReleaseDate(' 2012-03 ')).toBe('2012-03');
    expect(validReleaseDate('2012-03-14T10:00:00Z')).toBe('2012-03-14');
    expect(validReleaseDate('2012-03-14 10:00:00')).toBe('2012-03-14');
  });

  it('gives null for a missing or impossible date', () => {
    expect(validReleaseDate(null)).toBeNull();
    expect(validReleaseDate(undefined)).toBeNull();
    expect(validReleaseDate('')).toBeNull();
    expect(validReleaseDate('2024-99-99')).toBeNull();
    expect(validReleaseDate('2024-03-155')).toBeNull();
    expect(validReleaseDate('March 2024')).toBeNull();
  });
});
