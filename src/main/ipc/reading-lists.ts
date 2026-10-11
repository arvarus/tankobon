import type { ReadingListRepository } from '../db/reading-list-repository';
import type { NotifyDataChange } from './data-changes';
import { handle } from './handle';
import { args, expectString, expectStringArray, idArg } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const READING_LIST_CHANNELS = {
  list: 'reading-lists:list',
  create: 'reading-lists:create',
  rename: 'reading-lists:rename',
  remove: 'reading-lists:remove',
  addEntry: 'reading-lists:add-entry',
  addEntries: 'reading-lists:add-entries',
  removeEntry: 'reading-lists:remove-entry',
  reorder: 'reading-lists:reorder',
  reorderLists: 'reading-lists:reorder-lists',
} as const;

const nameArg = (value: unknown) => expectString(value, 'name');
const idsArg = (value: unknown) => expectStringArray(value, 'ids');

export function registerReadingListIpc(repo: ReadingListRepository, notify: NotifyDataChange): void {
  /** Runs a write, then announces it (a refused one changed nothing, but reloading is harmless). */
  const written = <R>(result: R): R => {
    notify({ scope: 'readingLists' });
    return result;
  };

  handle(READING_LIST_CHANNELS.list, args(), () => repo.list());

  handle(READING_LIST_CHANNELS.create, args(nameArg), (_event, name) => written(repo.create(name)));

  handle(READING_LIST_CHANNELS.rename, args(idArg, nameArg), (_event, id, name) => written(repo.rename(id, name)));

  handle(READING_LIST_CHANNELS.remove, args(idArg), (_event, id) => written(repo.remove(id)));

  handle(READING_LIST_CHANNELS.addEntry, args(idArg, idArg), (_event, id, libraryId) =>
    written(repo.addEntry(id, libraryId)),
  );

  handle(READING_LIST_CHANNELS.addEntries, args(idArg, idsArg), (_event, id, libraryIds) =>
    written(repo.addEntries(id, libraryIds)),
  );

  handle(READING_LIST_CHANNELS.removeEntry, args(idArg, idArg), (_event, id, libraryId) =>
    written(repo.removeEntry(id, libraryId)),
  );

  handle(READING_LIST_CHANNELS.reorder, args(idArg, idsArg), (_event, id, entryIds) =>
    written(repo.reorder(id, entryIds)),
  );

  handle(READING_LIST_CHANNELS.reorderLists, args(idsArg), (_event, listIds) => written(repo.reorderLists(listIds)));
}
