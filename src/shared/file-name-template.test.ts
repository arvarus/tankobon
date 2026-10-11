import { describe, expect, it } from 'vitest';

import { fileNameTemplateError, fillFileNameTemplate, isFileNameTemplate } from './file-name-template';

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
