import { describe, expect, it } from 'vitest';

import type { LibraryEntry } from '@/shared/library';

import { selectedEntries, toggleSelection } from './library-selection';

const order = ['a', 'b', 'c', 'd', 'e'];

describe('toggleSelection', () => {
  it('toggles one book on a plain click', () => {
    expect([...toggleSelection(new Set(), order, 'b', null, false)]).toEqual(['b']);
    expect([...toggleSelection(new Set(['b', 'c']), order, 'b', 'c', false)]).toEqual(['c']);
  });

  it('selects the range from the anchor on a Shift-click, in either direction', () => {
    expect([...toggleSelection(new Set(['b']), order, 'd', 'b', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...toggleSelection(new Set(['d']), order, 'a', 'd', true)].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('deselects the range when the clicked book was selected', () => {
    const selected = new Set(['a', 'b', 'c', 'd']);
    expect([...toggleSelection(selected, order, 'b', 'd', true)]).toEqual(['a']);
  });

  it('falls back to a plain click when the anchor is no longer shown', () => {
    expect([...toggleSelection(new Set(['z']), order, 'c', 'z', true)].sort()).toEqual(['c', 'z']);
  });

  it('leaves the given set untouched', () => {
    const selected = new Set(['a']);
    toggleSelection(selected, order, 'c', 'a', true);
    expect([...selected]).toEqual(['a']);
  });
});

describe('selectedEntries', () => {
  const entry = (id: string) => ({ id }) as LibraryEntry;
  const library = ['a', 'b', 'c', 'd'].map(entry);

  it('puts the shown books first, in screen order, then the hidden ones, and drops unknown ids', () => {
    const visible = [library[2], library[0]];
    const ids = selectedEntries(new Set(['a', 'b', 'c', 'gone']), visible, library).map((e) => e.id);
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('is empty without a selection', () => {
    expect(selectedEntries(new Set(), library, library)).toEqual([]);
  });
});
