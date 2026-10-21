import { describe, expect, it } from 'vitest';

import {
  fileNameTemplateError,
  fillFileNameTemplate,
  isFileNameTemplate,
  padVolume,
  parseFileName,
} from './file-name-template';

describe('fileNameTemplateError', () => {
  it('accepts the known fields, plain text and the empty template', () => {
    expect(fileNameTemplateError('{series} - T{volume} - {title} ({year}, {author})')).toBeNull();
    expect(fileNameTemplateError('Album')).toBeNull();
    expect(fileNameTemplateError('')).toBeNull();
  });

  it('refuses path separators, stray braces, unknown fields and an overlong template', () => {
    expect(fileNameTemplateError('{series}/{title}')).toBe('separator');
    expect(fileNameTemplateError('{series}\\{title}')).toBe('separator');
    expect(fileNameTemplateError('{serie} - {title}')).toBe('braces');
    expect(fileNameTemplateError('{title')).toBe('braces');
    expect(fileNameTemplateError('{Title}')).toBe('braces');
    expect(fileNameTemplateError('x'.repeat(201))).toBe('length');
  });

  it('only accepts strings', () => {
    expect(isFileNameTemplate('{title}')).toBe(true);
    expect(isFileNameTemplate(12)).toBe(false);
  });
});

describe('fillFileNameTemplate', () => {
  it('replaces every field, as many times as it appears', () => {
    const values = { series: 'Tintin', volume: '20', title: 'Tintin au Tibet', year: '1960', author: 'Hergé' };
    expect(fillFileNameTemplate('{series} - T{volume} - {title}', values)).toBe('Tintin - T20 - Tintin au Tibet');
    expect(fillFileNameTemplate('{author} {year} {author}', values)).toBe('Hergé 1960 Hergé');
  });
});

describe('parseFileName', () => {
  it('reads the fields back, the reverse of fillFileNameTemplate', () => {
    const template = '{series} - T{volume} - {title}';
    const name = fillFileNameTemplate(template, { series: 'Tintin', volume: '20', title: 'Tintin au Tibet', year: '', author: '' });
    expect(parseFileName(name, template)).toEqual({ series: 'Tintin', volume: '20', title: 'Tintin au Tibet' });
  });

  it('treats underscores as spaces and ignores case in the literals', () => {
    expect(parseFileName('Blacksad_t02', '{series} T{volume}')).toEqual({ series: 'Blacksad', volume: '02' });
  });

  it('reads a year as four digits', () => {
    expect(parseFileName('Blacksad (2003)', '{series} ({year})')).toEqual({ series: 'Blacksad', year: '2003' });
    expect(parseFileName('Blacksad (03)', '{series} ({year})')).toBeNull();
  });

  it('is null when the name does not match, the template has no field or is invalid', () => {
    expect(parseFileName('Blacksad', '{series} - T{volume}')).toBeNull();
    expect(parseFileName('Blacksad', '')).toBeNull();
    expect(parseFileName('Blacksad', 'Blacksad')).toBeNull();
    expect(parseFileName('a/b', '{series}/{title}')).toBeNull();
  });

  it('keeps the first value of a repeated field', () => {
    expect(parseFileName('A - B', '{title} - {title}')).toEqual({ title: 'A' });
  });
});

describe('volume padding', () => {
  const values = { series: 'Tintin', volume: '7', title: 'Le Lotus bleu', year: '1936', author: 'Hergé' };

  it('pads a whole-number volume with zeros to the requested width', () => {
    expect(padVolume('7', 2)).toBe('07');
    expect(padVolume('7', 3)).toBe('007');
    expect(padVolume('12', 2)).toBe('12');
    expect(padVolume('123', 2)).toBe('123');
    expect(padVolume('0', 2)).toBe('00');
  });

  it('leaves any other volume as it is', () => {
    for (const volume of ['HS', '12.1', '1/2', '3-4', 'Unknown', '']) expect(padVolume(volume, 3)).toBe(volume);
  });

  it('fills {volume:N} in a template, {volume} staying as it is', () => {
    expect(fillFileNameTemplate('{series} T{volume:2}', values)).toBe('Tintin T07');
    expect(fillFileNameTemplate('{series} T{volume:4}', values)).toBe('Tintin T0007');
    expect(fillFileNameTemplate('{series} T{volume}', values)).toBe('Tintin T7');
    expect(fillFileNameTemplate('T{volume:2}', { ...values, volume: 'HS' })).toBe('THS');
  });

  it('accepts widths 1 to 4 on volume only', () => {
    expect(isFileNameTemplate('{volume:1}')).toBe(true);
    expect(isFileNameTemplate('{volume:4}')).toBe(true);
    for (const template of ['{volume:0}', '{volume:5}', '{volume:}', '{volume:a}', '{series:2}', '{title:2}', '{volume:2'])
      expect(fileNameTemplateError(template)).toBe('braces');
  });

  it('reads a padded volume back without its zeros', () => {
    expect(parseFileName('Tintin - T07', '{series} - T{volume:2}')).toEqual({ series: 'Tintin', volume: '7' });
    expect(parseFileName('Tintin - T012', '{series} - T{volume:3}')).toEqual({ series: 'Tintin', volume: '12' });
    expect(parseFileName('Tintin - T00', '{series} - T{volume:2}')).toEqual({ series: 'Tintin', volume: '0' });
    expect(parseFileName('Tintin - THS', '{series} - T{volume:2}')).toEqual({ series: 'Tintin', volume: 'HS' });
  });
});
