import { describe, expect, it } from 'vitest';

import { bookTooltip, fileBaseName } from './book-tooltip';

describe('fileBaseName', () => {
  it('drops the folders, whichever separator', () => {
    expect(fileBaseName('/books/Tintin T20.cbz')).toBe('Tintin T20.cbz');
    expect(fileBaseName('C:\\BD\\Tintin\\T20.cbz')).toBe('T20.cbz');
    expect(fileBaseName('T20.cbz')).toBe('T20.cbz');
  });
});

describe('bookTooltip', () => {
  const path = '/books/Tintin/T20.cbz';

  it('names the series and the title', () => {
    expect(bookTooltip({ series: 'Tintin', title: 'Tintin au Tibet', path })).toBe('Tintin — Tintin au Tibet');
  });

  it('writes a name once when the series and the title are the same', () => {
    expect(bookTooltip({ series: 'Blacksad', title: 'blacksad', path })).toBe('blacksad');
  });

  it('falls back on whichever of the two is known', () => {
    expect(bookTooltip({ series: null, title: 'Tintin au Tibet', path })).toBe('Tintin au Tibet');
    expect(bookTooltip({ series: 'Tintin', title: '  ', path })).toBe('Tintin');
  });

  it('falls back on the file name, never the folders, when neither is known', () => {
    expect(bookTooltip({ series: '', title: '', path })).toBe('T20.cbz');
    expect(bookTooltip({ path })).toBe('T20.cbz');
  });
});
