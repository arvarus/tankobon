import { describe, expect, it } from 'vitest';

import type { LibraryEntry } from '@/shared/library';
import { MAX_FILE_NAME_RULES } from '@/shared/settings';

import { fileStem, initialLookupQuery, initialRuleState, offeredRules, queryFromRule, rememberRule } from './lookup-query';

const entry = (patch: Partial<LibraryEntry> = {}) =>
  ({ path: '/books/Blacksad_T02.cbz', title: 'Blacksad_T02', series: null, volume: null, releaseDate: null, language: null, credits: [], ...patch }) as LibraryEntry;

describe('fileStem', () => {
  it('drops the folders and the extension', () => {
    expect(fileStem('/books/Blacksad_T02.cbz')).toBe('Blacksad_T02');
    expect(fileStem('C:\\books\\My.Comic.cbr')).toBe('My.Comic');
    expect(fileStem('/books/.hidden')).toBe('.hidden');
  });
});

describe('initialLookupQuery', () => {
  it('uses the file name when the book has no information', () => {
    expect(initialLookupQuery(entry())).toEqual({ text: 'Blacksad_T02', volume: null });
  });

  it('uses the series and volume of the fiche', () => {
    expect(initialLookupQuery(entry({ series: 'Blacksad', volume: '2' }))).toEqual({ text: 'Blacksad', volume: '2' });
  });

  it('uses the title of a fiche that has no series', () => {
    expect(initialLookupQuery(entry({ title: 'Arctic Nation', releaseDate: '2003' }))).toEqual({
      text: 'Arctic Nation',
      volume: null,
    });
  });
});

describe('queryFromRule', () => {
  it('reads the series and the volume from the file name', () => {
    expect(queryFromRule(entry(), '{series} T{volume}')).toEqual({ text: 'Blacksad', volume: '02' });
  });

  it('is null when the name does not fit', () => {
    expect(queryFromRule(entry(), '{series} - {volume}')).toBeNull();
  });
});

describe('initialRuleState', () => {
  it('applies the most recent used rule that fits the name', () => {
    expect(initialRuleState(entry(), ['{series} - {volume}', '{series} T{volume}'])).toEqual({
      rule: '{series} T{volume}',
      query: { text: 'Blacksad', volume: '02' },
    });
  });

  it('shows the latest rule with the plain file name when none fits', () => {
    expect(initialRuleState(entry(), ['{series} - {volume}'])).toEqual({
      rule: '{series} - {volume}',
      query: { text: 'Blacksad_T02', volume: null },
    });
  });

  it('starts empty without any previous rule', () => {
    expect(initialRuleState(entry(), [])).toEqual({ rule: '', query: { text: 'Blacksad_T02', volume: null } });
  });
});

describe('rules', () => {
  it('offers the used rules, then the library template, without repeats or blanks', () => {
    expect(offeredRules(['{series} T{volume}'], '{series} T{volume}')).toEqual(['{series} T{volume}']);
    expect(offeredRules(['a{title}'], '{series}')).toEqual(['a{title}', '{series}']);
    expect(offeredRules([], '')).toEqual([]);
  });

  it('remembers the latest rule first and keeps a bounded history', () => {
    expect(rememberRule(['{a}', '{b}'], '{b}')).toEqual(['{b}', '{a}']);
    const many = Array.from({ length: MAX_FILE_NAME_RULES }, (_, index) => `x${index}{title}`);
    expect(rememberRule(many, '{series}')).toHaveLength(MAX_FILE_NAME_RULES);
  });
});
