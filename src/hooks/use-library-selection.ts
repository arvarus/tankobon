/**
 * The books ticked on the library page for a group action.
 * @module
 */
import { useMemo, useState } from 'react';

import { selectedEntries, toggleSelection } from '@/lib/library-selection';
import type { LibraryEntry } from '@/shared/library';

/** What {@link useLibrarySelection} returns. */
export interface LibrarySelection {
  /** Ids of the ticked books, kept across filter changes. */
  selected: ReadonlySet<string>;
  /** The ticked books, the ones shown first (in screen order) then the hidden ones (library order). */
  selection: LibraryEntry[];
  /** How many of the shown books are ticked. */
  shownSelected: number;
  /** Ticks or unticks a book; with `shift`, the whole range from the book ticked last. */
  tick: (id: string, shift: boolean) => void;
  /** Ticks every shown book, or unticks them all when they already are. */
  tickAllShown: () => void;
  /** Unticks everything. */
  clear: () => void;
}

/**
 * The selection of the library page: ids are kept across filter changes, so a selection can be built
 * from several searches. `shown` is the books in the order they are drawn, which gives a Shift-click
 * range its meaning; `entries` is the whole library, to find the ticked books that are not shown.
 */
export function useLibrarySelection(shown: readonly LibraryEntry[], entries: readonly LibraryEntry[]): LibrarySelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The book ticked last, the start of a Shift-click range.
  const [anchor, setAnchor] = useState<string | null>(null);
  const selection = useMemo(() => selectedEntries(selected, shown, entries), [selected, shown, entries]);
  const shownSelected = shown.filter((entry) => selected.has(entry.id)).length;

  const tick = (id: string, shift: boolean) => {
    setSelected(toggleSelection(selected, shown.map((entry) => entry.id), id, anchor, shift));
    setAnchor(id);
  };

  const tickAllShown = () => {
    const next = new Set(selected);
    const select = shownSelected < shown.length;
    for (const entry of shown) {
      if (select) next.add(entry.id);
      else next.delete(entry.id);
    }
    setSelected(next);
  };

  return { selected, selection, shownSelected, tick, tickAllShown, clear: () => setSelected(new Set()) };
}
