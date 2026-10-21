import { describe, expect, it } from 'vitest';

import { newCreditRow } from './book-edit';
import { bulkCurrent, bulkToUpdate, emptyBulkForm, validateBulkForm } from './book-bulk-edit';
import type { LibraryEntry } from '@/shared/library';

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'id',
    path: '/comics/a.cbz',
    title: 'A',
    pageCount: 10,
    currentPage: 0,
    addedAt: '2026-01-01T00:00:00.000Z',
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
    fileCount: 10,
    fileSize: 1000,
    rating: 0,
    tags: [],
    titleLocked: false,
    series: null,
    volume: null,
    releaseDate: null,
    language: null,
    avgPageWidth: null,
    avgPageHeight: null,
    credits: [],
    ...overrides,
  };
}

describe('bulkCurrent', () => {
  it('gives the shared value, or mixed when the books differ', () => {
    const current = bulkCurrent([
      entry({ series: 'Blacksad', volume: '1', language: 'fr' }),
      entry({ series: 'Blacksad', volume: '2', language: null }),
    ]);
    expect(current.series).toEqual({ mixed: false, value: 'Blacksad' });
    expect(current.volume).toEqual({ mixed: true });
    expect(current.language).toEqual({ mixed: true });
    expect(current.releaseDate).toEqual({ mixed: false, value: '' });
  });
});

describe('bulkToUpdate', () => {
  it('writes the ticked fields only', () => {
    const form = emptyBulkForm(bulkCurrent([entry(), entry()]));
    form.values.series = ' Blacksad ';
    form.values.language = 'FR';
    form.values.volume = '3';
    form.enabled = new Set(['series', 'language']);
    expect(bulkToUpdate(form)).toEqual({ series: 'Blacksad', language: 'fr' });
  });

  it('clears a ticked field left empty and replaces the credits', () => {
    const form = emptyBulkForm(bulkCurrent([entry({ series: 'X' })]));
    form.values.series = '';
    form.values.credits = [
      newCreditRow({
        firstName: ' Juanjo ',
        lastName: 'Guarnido',
        role: 'artist',
      }),
      newCreditRow(),
    ];
    form.enabled = new Set(['series', 'credits']);
    expect(bulkToUpdate(form)).toEqual({
      series: null,
      credits: [{ firstName: 'Juanjo', lastName: 'Guarnido', role: 'artist' }],
    });
  });
});

describe('validateBulkForm', () => {
  it('only checks the ticked fields', () => {
    const form = emptyBulkForm(bulkCurrent([entry()]));
    form.values.releaseDate = '2003-99';
    expect(validateBulkForm(form)).toEqual({});
    form.enabled = new Set(['releaseDate']);
    expect(validateBulkForm(form).releaseDate).toBeTruthy();
  });
});
