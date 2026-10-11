import { describe, expect, it } from 'vitest';

import { fileNameExample, levelChoices, setLevel, structureExample } from './library-structure';

describe('levelChoices', () => {
  it('offers every level first, and neither letter nor year after', () => {
    expect(levelChoices([], 0)).toEqual(['letter', 'year', 'author', 'series', 'album']);
    expect(levelChoices(['author'], 1)).toEqual(['series', 'album']);
  });

  it('leaves out the levels used elsewhere but keeps the current one', () => {
    expect(levelChoices(['letter', 'series'], 1)).toEqual(['author', 'series', 'album']);
    expect(levelChoices(['letter', 'series'], 0)).toEqual(['letter', 'year', 'author', 'album']);
  });

  it('offers nothing past the first free position', () => {
    expect(levelChoices([], 1)).toEqual([]);
    expect(levelChoices(['series'], 2)).toEqual([]);
    expect(levelChoices(['letter', 'author', 'series'], 3)).toEqual([]);
  });
});

describe('setLevel', () => {
  it('sets a position, and empties it with the ones after on null', () => {
    expect(setLevel([], 0, 'letter')).toEqual(['letter']);
    expect(setLevel(['letter'], 1, 'series')).toEqual(['letter', 'series']);
    expect(setLevel(['letter', 'author', 'series'], 1, null)).toEqual(['letter']);
  });

  it('drops a later duplicate', () => {
    expect(setLevel(['letter', 'series', 'album'], 0, 'series')).toEqual(['series', 'album']);
  });
});

describe('structureExample', () => {
  it('shows where the sample album goes', () => {
    expect(structureExample(['letter', 'series'])).toBe('T/Tintin/Tintin au Tibet.cbz');
    expect(structureExample(['year', 'author', 'album'])).toBe('1960/Hergé/Tintin au Tibet/Tintin au Tibet.cbz');
    expect(structureExample([])).toBe('');
  });
});

describe('fileNameExample', () => {
  it('names the sample album after the template, or its original name without one', () => {
    expect(fileNameExample('{series} - T{volume} - {title}')).toBe('Tintin - T20 - Tintin au Tibet.cbz');
    expect(fileNameExample('{author} ({year})')).toBe('Hergé (1960).cbz');
    expect(fileNameExample('')).toBe('Tintin au Tibet.cbz');
  });

  it('is the last part of the structure example', () => {
    expect(structureExample(['series'], '{series} {volume}')).toBe('Tintin/Tintin 20.cbz');
  });
});
