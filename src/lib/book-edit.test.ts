import { describe, expect, it } from 'vitest';

import { entryToForm, formToUpdate, isValidForm, newCreditRow, validateForm } from './book-edit';
import type { LibraryEntry } from '@/shared/library';

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'id',
    path: '/comics/Blacksad_T02.cbz',
    title: 'Blacksad_T02',
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

const credited = entry({
  series: 'Blacksad',
  volume: '2',
  releaseDate: '2003',
  language: 'fr',
  credits: [
    {
      personId: 'p1',
      firstName: 'Juan',
      lastName: 'Díaz Canales',
      role: 'writer',
    },
    {
      personId: 'p2',
      firstName: 'Juanjo',
      lastName: 'Guarnido',
      role: 'artist',
    },
  ],
});

describe('entryToForm', () => {
  it('prefills every field, nulls as empty strings', () => {
    const form = entryToForm(entry());
    expect(form).toMatchObject({
      title: 'Blacksad_T02',
      series: '',
      volume: '',
      releaseDate: '',
      language: '',
    });
    expect(form.credits).toEqual([]);
  });

  it('gives each credit row a distinct key', () => {
    const form = entryToForm(credited);
    expect(form.credits.map((row) => row.lastName)).toEqual(['Díaz Canales', 'Guarnido']);
    expect(new Set(form.credits.map((row) => row.key)).size).toBe(2);
  });
});

describe('validateForm', () => {
  it('accepts an unchanged form', () => {
    expect(isValidForm(validateForm(entryToForm(credited)))).toBe(true);
  });

  it('refuses an empty title and a bad date', () => {
    const errors = validateForm({
      ...entryToForm(entry()),
      title: '  ',
      releaseDate: 'nov. 2003',
      language: 'fra',
    });
    expect(Object.keys(errors).sort()).toEqual(['releaseDate', 'title']);
    expect(isValidForm(errors)).toBe(false);
  });

  it('refuses a credit with a first name but no last name, and ignores blank rows', () => {
    const named = newCreditRow({
      firstName: 'Juan',
      lastName: ' ',
      role: 'writer',
    });
    const blank = newCreditRow();
    const errors = validateForm({
      ...entryToForm(entry()),
      credits: [named, blank],
    });
    expect(Object.keys(errors.credits ?? {})).toEqual([named.key]);
  });
});

describe('formToUpdate', () => {
  it('is empty when nothing changed', () => {
    expect(formToUpdate(credited, entryToForm(credited))).toEqual({});
  });

  it('only carries the changed fields, trimmed', () => {
    const form = {
      ...entryToForm(credited),
      volume: ' 3 ',
      releaseDate: '2005-06',
    };
    expect(formToUpdate(credited, form)).toEqual({
      volume: '3',
      releaseDate: '2005-06',
    });
  });

  it('clears an emptied field and lowercases the language', () => {
    expect(
      formToUpdate(credited, {
        ...entryToForm(credited),
        series: ' ',
        language: 'EN',
      }),
    ).toEqual({
      series: null,
      language: 'en',
    });
  });

  it('sets the title only when it changed', () => {
    expect(
      formToUpdate(credited, {
        ...entryToForm(credited),
        title: ' Blacksad_T02 ',
      }),
    ).toEqual({});
    expect(
      formToUpdate(credited, {
        ...entryToForm(credited),
        title: 'Arctic Nation',
      }),
    ).toEqual({
      title: 'Arctic Nation',
    });
  });

  it('replaces the whole credit list when a row is edited, added or removed, dropping blank rows', () => {
    const form = entryToForm(credited);
    const edited = {
      ...form,
      credits: [
        { ...form.credits[0], role: 'author' as const },
        newCreditRow(),
        newCreditRow({ firstName: '', lastName: ' Hergé ', role: 'cover' }),
      ],
    };
    expect(formToUpdate(credited, edited).credits).toEqual([
      { firstName: 'Juan', lastName: 'Díaz Canales', role: 'author' },
      { firstName: '', lastName: 'Hergé', role: 'cover' },
    ]);
  });

  it('treats a fixed accent or case as a change', () => {
    const form = entryToForm(credited);
    const edited = {
      ...form,
      credits: [{ ...form.credits[0], lastName: 'Diaz Canales' }, form.credits[1]],
    };
    expect(formToUpdate(credited, edited).credits?.[0].lastName).toBe('Diaz Canales');
  });

  it('can remove every credit', () => {
    expect(formToUpdate(credited, { ...entryToForm(credited), credits: [] })).toEqual({ credits: [] });
  });
});
