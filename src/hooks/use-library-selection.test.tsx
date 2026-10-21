// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { LibraryEntry } from '@/shared/library';
import { useLibrarySelection } from './use-library-selection';

const book = (id: string) => ({ id }) as LibraryEntry;
const library = ['a', 'b', 'c', 'd'].map(book);

describe('useLibrarySelection', () => {
  it('ticks a book, then a Shift-click range from it', () => {
    const { result } = renderHook(() => useLibrarySelection(library, library));
    act(() => result.current.tick('a', false));
    act(() => result.current.tick('c', true));
    expect([...result.current.selected].sort()).toEqual(['a', 'b', 'c']);
    expect(result.current.shownSelected).toBe(3);
  });

  it('ticks every shown book, then unticks them all', () => {
    const { result } = renderHook(() => useLibrarySelection(library, library));
    act(() => result.current.tickAllShown());
    expect(result.current.selection.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
    act(() => result.current.tickAllShown());
    expect(result.current.selected.size).toBe(0);
  });

  it('keeps the books a filter hides, after the shown ones', () => {
    const { result, rerender } = renderHook(({ shown }) => useLibrarySelection(shown, library), { initialProps: { shown: library } });
    act(() => result.current.tick('a', false));
    act(() => result.current.tick('c', false));
    rerender({ shown: [library[2]] });
    expect(result.current.selection.map((e) => e.id)).toEqual(['c', 'a']);
    act(() => result.current.clear());
    expect(result.current.selection).toEqual([]);
  });
});
