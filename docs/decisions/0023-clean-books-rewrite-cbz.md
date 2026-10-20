# 0023. Cleaning the books by rewriting the CBZ archives

- **Status:** Accepted
- **Date:** 2026-10-20

## Context

Comic archives often carry files that are not pages (`Thumbs.db`, `.DS_Store`, macOS resource forks, text files, a stray `ComicInfo.xml`). Users want to strip them from the library in bulk, after seeing what would go, and keep the kinds they care about.

## Decision

- **Two steps**: `library:analyze-cleanup` lists the non-image files of the books asked for (a selection, else the whole library) without touching anything and returns a summary grouped by extension plus an opaque token; `library:apply-cleanup` takes that token and the extensions to *keep*. The renderer never names a path or an archive entry: the main process remembers the plan (the last 5 analyses, each usable once).
- **Only CBZ**: a RAR can't be written by the libraries we use and a PDF has no such files. Other formats, and cloud placeholders (reading them would download them), are counted as skipped.
- **Rewrite beside, verify, then replace**: the decoder process (`cbz-cleaner.ts`) streams the kept entries into `<file>.cleaning.tmp` with `yazl` (pages stored as they are, mtimes kept, directory entries dropped), reopens the result, checks that its pages and entry count are the expected ones, and only then renames it over the original. A name that is no longer in the archive, or that is a page, aborts the rewrite. Any failure leaves the original untouched.
- **New dependency**: `yazl` (small, pure JS, bundled into the decoder). `node-stream-zip` stays the reader.
- After a rewrite the entry's `file_count` and `file_size` are updated (`updateFileStats()`) and the views are notified; the pages, covers and reading progress are unchanged.

## Consequences

- The cleanup is destructive for the removed files (they are not sent to the trash: they live inside the archive). The summary and the confirmation button are the safeguard, hence the two steps.
- A book open in the reader during its rewrite may fail to replace on Windows; it is reported as failed and left as it was.
- RAR comics are never modified.

## Alternatives considered

- **Hand-written ZIP writer**: no dependency, but more code to get right (CRC, data descriptors, ZIP64).
- **Delete in place**: not possible with ZIP without rewriting, and not crash-safe.
