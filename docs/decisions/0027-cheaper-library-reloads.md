# 0027. Cheaper library reloads: deltas and projections before SQL search

- **Status:** Proposed
- **Date:** 2026-10-25

## Context

[ADR 0013](./0013-renderer-data-store-data-changed.md) keeps the whole library in the renderer and filters it there, and says that moving the search into SQL is "the next step beyond a few tens of thousands of books". The target is 20 000 books or more. Before deciding what that step is, the costs were measured (synthetic library, in-memory SQLite, Node 22.22, one run after a warm-up; 800 series, three credits per book; the figures are orders of magnitude, not benchmarks):

| Books | `LibraryRepository.list()` | Structured clone (serialize + deserialize) | Size crossing IPC | `applyLibraryChange()` for one entry |
|---|---|---|---|---|
| 5 000 | 0.10 s | 0.07 s | 3.5 MB | 0.13 ms |
| 20 000 | 0.44–0.52 s | 0.15 s + 0.27 s | 14 MB | 1 ms |
| 50 000 | 1.9 s | 0.47 s + 0.24 s | 35 MB | 2.7 ms |

What the figures say:

- **A page turn is not the problem.** Replacing one entry copies the array in about 1 ms at 20 000 books (3 ms at 50 000). Nothing needs to change there.
- **A full reload is.** `list()` is synchronous SQLite on the main process's thread: 0.5 s at 20 000 books during which no IPC is served, then 14 MB cloned and rebuilt in the renderer. Of those 0.44 s, the entry query is 0.08 s, the credits query 0.14 s, and the rest is building objects (JSON of the tags, path decoding, credits grouped per book).
- **Reloads are frequent in bulk writes**: every folder scan, resynchronization, addition, organization, CBR conversion, cleaning and import ends with `notify({ scope: 'library' })`, which makes every window reload the whole slice (`DataStore.apply()`).
- **The main process asks for far more than it needs.** `resyncLibrary()` calls `repo.list()` once per folder plus twice more (`library-sync.ts`), `data:import` twice (`idByPath`, the thumbnail rebuild), the cleaner once, though most of these only read `id` and `path`.
- **Credits cannot simply be dropped from the list**: the search matches the authors' names (`library-filter.ts`), the rows show them (`book-row.tsx`), the achievements count the documented books (`achievements.ts`), `hasFiche()` reads them, and the edit dialogs start from them. Without credits the list is only 46 % lighter (7.7 MB instead of 14 MB at 20 000 books), so a "light list plus `library:get(ids)`" would add a request path everywhere for under half of the clone.
- **SQLite's FTS5 is available** (`CREATE VIRTUAL TABLE … USING fts5` works on `node:sqlite` here; it has to be checked on Electron 44's bundled Node in a packaged app before relying on it), and a prefix match over 20 000 rows takes under a millisecond. But in-memory filtering of 20 000 books is also a matter of milliseconds (ADR 0013), so SQL search buys nothing before the list itself stops fitting in memory.

## Decision

Reduce what a reload costs and how often it happens, before changing where the search runs.

1. **Keep ADR 0013's model** up to about 50 000 books: the renderer holds the whole library and filters it. Nothing changes for page turns, search, sorting or grouping.
2. **Bulk writes push their entries instead of asking for a reload.** The scan, the resynchronization, `library:add-file`, the organization, the CBR conversion, the cleaning and the relinking of a folder send `data:changed` with the `upserted` entries and `removed` ids they know, in batches of at most 500 entries per message (a message is one structured clone), read with a new `LibraryRepository.getMany(ids)` (one query for the entries, one for their credits). A payload-less library change (a reload) stays for what has no short list of changes: clearing the library, the JSON import, a change of user and a migration of paths (`adoptRoots()`).
3. **The main process reads projections when it needs two fields.** `LibraryRepository.listPaths()` (`{ id, path }`, no credits, no tags parsing) replaces `list()` wherever only the path or id is used: the resynchronization (once per run instead of once per folder plus twice), the import's `idByPath`, the thumbnail rebuild and prune, and the cleaner's selection. `list()` stays for the export, the organizer's `unorganizedIds()` (it reads titles, series and credits) and the renderer's `library:list`.
4. **`list()` itself gets cheaper without changing its result**: credits grouped in one pass over the ordered credit rows, the tags parsed only when the stored text isn't the default `'[]'`, the path decoded once per distinct folder prefix. Target: under 250 ms at 20 000 books, checked by a benchmark kept next to `library-repository.test.ts` (not part of `npm test`).
5. **SQL search and paging are deferred, with explicit triggers**: a full reload above 1 s on a typical machine, or a library above 50 000 books, or the renderer's memory for the library above what the reader needs (the reader's pages are released at 3 000 px, ADR 0013's list is not). The design to start from, when one of them is met, is recorded here so it isn't invented under pressure: a `library_fts` FTS5 table (`title`, `path`, `series`, `authors`) kept by `LibraryRepository`'s writers inside their transactions and filled by a migration (ADR 0010), a `library:search` channel answering ids in the display order for a query, filters and sort, and a store that holds a window of entries plus the ids of the whole result. That step supersedes ADR 0013's "filtering stays in the renderer" and gets its own ADR.

## Consequences

- A scan of 5 000 books no longer ends with a 0.1 s main-process pause, a 3.5 MB clone per window and a full rebuild of the renderer's array: the views receive the new books as the scan goes (in batches), which also lets the library page show them before the end.
- The `data:changed` contract gains a rule the writers must keep: a handler that changes several entries lists them (in batches) or, only when it cannot, sends the reload. Forgetting a book in a delta leaves it stale until the next reload, where a forgotten `notify` already did; `data-store.test.ts` and the handlers' tests cover the batches.
- Out-of-order batches are safe: each carries whole entries, applied by `applyLibraryChange()` in arrival order, and the store already reloads when a change arrives during a load (`libraryChanges`).
- `listPaths()` and `getMany()` are two more repository methods to keep consistent with `ENTRY_SELECT` (the user-scoped columns and the path codec); they share its code rather than copy it.
- Nothing is lost against the in-memory model's limits: the numbers above put the point where it stops being comfortable around 50 000 books, and the trigger list says what to watch.

## Alternatives considered

- **A light `library:list` (no credits) with `library:get(ids)` for the details**: 46 % lighter at best, and every consumer of credits (search, rows, achievements, edit dialogs) would need the details path or a second request. The deltas in decision 2 remove more reloads than this removes bytes per reload.
- **Search and sort in SQL now (FTS5)**: the right shape for hundreds of thousands of books, but it moves the filters, the editions, the series grouping and the selection (which all work on the whole array, `library-groups.ts`, `library-editions.ts`) behind a query API, a migration and a second source of truth for the search text. Today's in-memory filtering costs milliseconds; the bill would come before the benefit.
- **Paging `library:list` into the store at start-up** (e.g. 2 000 entries per message): spreads the clone but not the main-thread `list()` or the final memory, and a view that needs the whole library (achievements, statistics, duplicates) must wait for the last page anyway.
- **Running `list()` in a worker thread** (as the backups, [ADR 0024](./0024-database-backups.md)): frees the main thread for the 0.5 s but keeps the clone and the frequency of reloads; worth reconsidering only if decision 4 doesn't reach its target.
