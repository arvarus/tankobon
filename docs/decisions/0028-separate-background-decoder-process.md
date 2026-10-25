# 0028. A second decoder process for background work, the reader keeps its own

- **Status:** Proposed
- **Date:** 2026-10-25

## Context

[ADR 0012](./0012-decoder-utility-process.md) moved the parsing of comic files into one decoder process, and [ADR 0018](./0018-decoder-timeouts-and-archive-ownership.md) bounded the calls that open a file (`open`, `inspect`, `measure`, `listJunk`) to 60 seconds, killing the process when one hangs. ADR 0018 accepted that the kill "also drops the archives other windows have open", reasoning that "a hang is rare, and so is a second window mid-read at that moment". That reasoning counted windows; the real overlap is not between windows but between *kinds of work* in the one process.

Everything shares that one process and its event loop:

| Work | Calls | Who starts it |
|---|---|---|
| The open book | `open`, `readPage`, `close` | The reader, on every page turn |
| The scan, resynchronization and addition | `inspect` (opens the file, counts pages, caches the cover) | A folder added, `resyncOnStartup`, `library:add-file` |
| The background page-size measure | `measure` | `ImageStatsScanner`, after each addition and at every start |
| Covers | `thumbnail`, `setThumbnail`, `removeThumbnail`, `pruneThumbnails`, `rebuildThumbnails` | The library page (hundreds of requests), the import |
| Archive rewriting | `listJunk`, `cleanArchive`, `convertCbr` | Paramètres › Organisation |

What goes wrong, from the code:

- **A slow file in the background costs the reader its book.** A resynchronization at start-up over a network share, or a large CBR on a slow drive, makes `inspect` or `measure` exceed 60 s; `DecoderClient.abandon()` then kills the process, and the book the user is reading loses its archive (`unknown archive` on the next page, then the reopen of `createRecoveryGuard()`). `resyncOnStartup`, the measure and the scan all run while the user opens a book, so the overlap is the normal case for a user with a large library, not a second window. The recovery path hides the symptom (a flash and a reopen), it does not remove it.
- **CPU-bound background work delays page turns.** The RAR decoder is WebAssembly drained synchronously (`withExtractor()`, `cbr-archive.ts`), so a scan or a measure over CBR files blocks the process's event loop while it runs; a `readPage` from the reader waits in the same loop. The requests are "concurrent" only as far as the work is asynchronous.
- **The cost of a second process is real but bounded.** A decoder after loading its dependencies (`@napi-rs/canvas`, pdf.js, `node-unrar-js`) takes about 100 MB of resident memory and some 150 ms to load in plain Node (measured: 42 MB bare, 77 MB with the canvas, 95 MB with pdf.js, 101 MB with unrar; the utility process adds its own overhead). A second process that is always on would double that for a user who never scans.
- **The thumbnail cache has to stay single-owner.** `ThumbnailCache` serializes every generation through one promise chain, and its `prune()` deletes every temporary file that isn't a library book's thumbnail. Two instances writing the same directory would race (a `prune()` in one removing the temporary file the other is about to rename). Today `comic:open` calls `thumbnail(path, archiveId)` so that the cover is made from the reader's already open archive, which is the one call that ties the cache to the reader's process.

## Decision

Run **two decoder processes from the same bundle**, chosen by the kind of work, and keep `DecoderClient` as the only API the rest of the main process sees.

1. **Roles, routed by method.** The client holds a table `DecoderMethod → role`:
   - `reader`: `open`, `readPage`, `close`. It owns the archives kept open (`ComicService`) and nothing else: it makes no cover, no scan, no rewrite.
   - `background`: `inspect`, `measure`, `listJunk`, `cleanArchive`, `convertCbr` and all the thumbnail calls (`thumbnail`, `setThumbnail`, `removeThumbnail`, `pruneThumbnails`, `rebuildThumbnails`). It owns the one `ThumbnailCache`.
   Both processes run the existing `decoder-worker.cjs` (no new bundle, no new build constraint: the table above, not the process, decides what it is asked). A role that is asked for a method outside its table would still answer it; the table is a routing rule, not a security boundary, and both processes parse untrusted input in the same way.
2. **The cover of a book just opened is made by the background process.** `comic:open` stops passing the reader's archive id: it asks `thumbnail(path)` of the background process, which opens the file itself if the cover is missing (a cover that exists, the usual case after a scan, is just read). The `archiveId` parameter of `DecoderMethods.thumbnail` and the `ensure(path, readFirstPage)` shortcut are removed. Cost: a book without a cover is opened twice, once by each process, the first time it is read; the open never waits for it.
3. **Timeouts and kills are per process** (ADR 0018 otherwise unchanged). `open` stays timed in the reader (a hung `open` kills the reader process, as before, with the same recovery); `inspect`, `measure` and `listJunk` are timed in the background one. A hang in the background process kills only it: pending background calls reject with `errors:decoder.crashed` (a scan counts the file as `failed`, a measure skips it, covers are asked again by the library page), the reader's archives are untouched.
4. **Lifecycle.** The reader process starts on the first `open`, as the single process does today, and lives until `will-quit`. The background process starts on its first call and **exits after an idle period** (`BACKGROUND_IDLE_MS`, 2 minutes with no call pending), so a user who is only reading, or who has a small library, pays for one process; the next call starts it again, initialised the same way. `init`, `language` and `sidecarCovers` control messages go to every running process and are replayed to a process when it starts.
5. **Ownership and caps stay with the reader.** `ArchiveOwners` and `MAX_OPEN_ARCHIVES` (8) concern the reader process only; the background process opens an archive for the length of one call and closes it.
6. **The client's surface does not change.** `DecoderClient.open()`, `inspect()`, `thumbnail()`… keep their signatures (except `thumbnail`'s dropped `archiveId`); `spawn` becomes `spawn(role)`, and `DecoderClient` keeps one channel and one pending-call table per role, so `abandon()` and `handleExit()` act on the channel the call went through. The `serviceName` of each process says its role in the OS task list.

## Consequences

- A slow or hanging file in a scan, a measure or a cleanup no longer interrupts the book being read, and background CPU work (RAR extraction, cover generation for a library page of hundreds of books) no longer shares the event loop with page turns.
- Memory: about 100 MB more while the background process lives, none when it is idle for 2 minutes. A library page that keeps asking for covers keeps it alive; that is its job.
- One more place where the order of events matters: control messages and the first call can reach a process in different order than today. The client sends `init` before any request on every start (as `ensureChannel()` does now), per channel, and the tests pin it.
- The first opening of a book that has no cover yet reads the file twice. Scans and `comic:open`'s previous behaviour mostly made the cover already (`inspect` caches it), so this is the exception: a book added by an old version, or whose sidecar was deleted.
- `ThumbnailCache` keeps its single queue and its `prune()` safety, since only one process ever holds it. A cover requested by the library page while a scan runs now queues behind the scan's covers in the same process (it did before), and not behind the reader's page renders (it did before).
- Killing the background process while `cleanArchive` or `convertCbr` runs (a hung `measure` can do it, the run lock does not cover the measure) leaves the temporary file of the rewrite, as a crash does today; both already remove it on the next attempt and never replace the original before the check. If this shows up in practice, the rewriting calls move to a third, short-lived role.
- Two processes in development: `forge.config.ts` already restarts on a `decoder-worker.cjs` rebuild, which restarts both.

## Alternatives considered

- **Raise or remove the timeout**: a hung file would then block a scan for ever, which ADR 0018 exists to prevent, and the reader would still share the event loop with the scan.
- **Kill only the hung call**: nothing in the process can interrupt a synchronous loop or a native call; only ending the process frees it (ADR 0018).
- **A pool of N identical decoders, any call to any of them**: spreads the CPU but not the blast radius: an archive is open in one process, so the reader's calls must go to that one, and a hang in any process still kills what it holds. Roles give the reader a process that nothing but the reader's own `open` can bring down.
- **A worker thread per call (as for the backups, ADR 0024)**: a thread shares the process, so the native crashes and memory blow-ups ADR 0012 isolates would take the app down again.
- **One process per kind of work (scan, measure, covers, rewrite)**: four to five times the memory for a gain beyond the reader/background split that doesn't show in the code; the rewrite role is kept as the next step if the consequence above materializes.
- **The background process made always-on**: simpler (no idle exit, no replay), but a constant 100 MB for users who never scan; the idle exit is a few lines in the client.

## Implementation plan (for the tickets once this is accepted)

1. `DecoderClient`: roles, the routing table, per-role channel and pending table, `spawn(role)`, idle exit of the background role, `init` replay; tests for the routing, a kill of one role leaving the other's calls alone, the idle exit and the restart.
2. `comic:open` and `DecoderMethods.thumbnail`: drop `archiveId`; `ThumbnailCache.ensure()` loses its `readFirstPage` parameter; their tests.
3. Documentation: `architecture.md` (Decoder process), ADRs 0012 and 0018 marked as amended by this one.
