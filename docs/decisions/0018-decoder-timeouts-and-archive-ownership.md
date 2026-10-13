# 0018. Decoder calls bounded by a timeout, archives tied to their window

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

[ADR 0012](./0012-decoder-utility-process.md) moved the parsing of comic files into a decoder process, so that a crash or an out-of-memory kill ends one request instead of the app. It covers a process that *dies*, not one that *hangs*: a file that makes a decoder loop (a booby-trapped PDF, a pathological archive) leaves its call pending forever. The reader then shows a spinner, a folder scan or the background page-size measure stops on that file, and nothing frees the process. Whether a real file can do this was not reproduced when this was written; the audit that raised it flagged it "to confirm", and the timeout below is cheap insurance rather than the fix for an observed failure.

Two smaller leaks sit next to it. An archive opened for the reader stays open in the decoder process until the renderer calls `comic:close`, which a crashed or closed window never does (a CBR keeps its whole file in memory, a CBZ a file descriptor). And nothing limits how many archives are open at once.

## Decision

- **Timeout**: `DecoderClient` bounds the calls that open a file, `open`, `inspect` and `measure`, to `OPEN_TIMEOUT_MS` (60 s). When one is still unanswered, the process is killed like after a crash: the hung call rejects with `errors:decoder.timeout`, every other pending call with `errors:decoder.crashed`, and the next call starts a fresh process (the same restart path as ADR 0012). `readPage` and the thumbnail calls have no timeout: a slow page render or a long `rebuildThumbnails` is legitimate, and the file was already opened successfully.
- **Ownership**: the `comic:open` handler records which window (`webContents` id) opened each archive (`ArchiveOwners`, `src/main/ipc/archive-owners.ts`) and, when that window is destroyed, closes the archives it still had open. `comic:close` forgets the archive.
- **Cap**: `ComicService` keeps at most `MAX_OPEN_ARCHIVES` (8) archives; opening one more closes the one opened longest ago.

## Consequences

- A hung decoder costs the user 60 s and a "took too long" message for that file, not a stuck spinner, and the scan or the measure moves on to the next file.
- Killing the process also drops the archives other windows have open: their next `readPage` fails with "unknown archive" until the book is reopened, as after a crash. Accepted: a hang is rare, and so is a second window mid-read at that moment.
- 60 s is a fixed constant, not a setting. A legitimate open (a CBR read fully into memory from a slow network drive) taking longer would be abandoned; if that shows up, the constant is the place to raise.
- A reader holding more than eight books open at once would see the oldest one fail on its next page. The reader opens one book per window, so this only bounds leaks.
- The renderer is untouched: a failed `open` already reaches it as an `OpenComicResult` error.

## Alternatives considered

- **A timeout on every call**: would cut off long but healthy work (`rebuildThumbnails` over thousands of books) and a PDF page render on a slow machine.
- **Aborting only the hung call**: nothing in the decoder can interrupt a synchronous loop or a native call; only ending the process frees it.
- **Refusing the ninth open instead of closing the oldest**: leaves the user unable to open a book until something is closed, with no way to know which leaked archive to blame.
- **Checking in `comic:read-page` that the sender owns the archive**: a worthwhile hardening, but a separate concern from leaks; not done here.
