/**
 * Pure logic of the library page's multiple selection: which books a click on a row's checkbox
 * selects (one, or a range with Shift), the order the selected books are added to a reading
 * list in, and which books a drag carries.
 * @module
 */
import type { LibraryEntry } from '@/shared/library';

/**
 * The selection after a click on the checkbox of the book `id`. A plain click toggles that book.
 * A Shift-click gives every book of `order` (the ids as shown) between `anchor`, the book clicked
 * last, and `id` the clicked book's new state, the way file managers do; without an anchor still
 * shown, it is a plain click. Returns a new set; `selected` is left as it is.
 */
export function toggleSelection(
  selected: ReadonlySet<string>,
  order: readonly string[],
  id: string,
  anchor: string | null,
  shift: boolean,
): Set<string> {
  const next = new Set(selected);
  const select = !selected.has(id);
  const from = shift && anchor !== null ? order.indexOf(anchor) : -1;
  const to = order.indexOf(id);
  const range = from === -1 || to === -1 ? [id] : order.slice(Math.min(from, to), Math.max(from, to) + 1);
  for (const member of range) {
    if (select) next.add(member);
    else next.delete(member);
  }
  return next;
}

/**
 * The selected books, in the order they go into a reading list: those shown (`visible`, the
 * filtered library) in their order on screen, then those the current filters hide, in library
 * order. Ids no longer in the library are dropped.
 */
export function selectedEntries(
  selected: ReadonlySet<string>,
  visible: readonly LibraryEntry[],
  library: readonly LibraryEntry[],
): LibraryEntry[] {
  if (selected.size === 0) return [];
  const shown = visible.filter((entry) => selected.has(entry.id));
  const shownIds = new Set(shown.map((entry) => entry.id));
  return [...shown, ...library.filter((entry) => selected.has(entry.id) && !shownIds.has(entry.id))];
}

/**
 * The books a drag from the grip of `entry` carries: the whole selection when `entry` is part of
 * it, otherwise `entry` alone (as in a file manager, dragging an unselected item leaves the
 * selection out). `selection` is in display order, see {@link selectedEntries}.
 */
export function draggedEntries(entry: LibraryEntry, selection: readonly LibraryEntry[]): LibraryEntry[] {
  return selection.some((selected) => selected.id === entry.id) ? [...selection] : [entry];
}
