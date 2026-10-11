# 0015. Library organization: the app moves files into one subfolder per comic

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

Until now the app never touched the comic files: the library pointed at them wherever they were, and the resynchronization only ever removed library entries. Users who want the app to keep their collection tidy asked for the opposite: the comics they add should be moved into a folder whose layout the app manages. Moving a user's file is the first destructive file operation of the app, so where it happens, who chooses the destination and what happens on failure must be settled once.

## Decision

- **Opt-in, three modes**: `AppSettings.libraryOrganization` is `off` (the default, the app never moves anything), `ask` (after each addition the renderer offers to move the comics just added) or `always`. In every mode but `off`, a comic found *inside* the organized folder (dropped there by hand, then picked up by a resynchronization or an addition) is moved into place without asking.
- **One level, one subfolder per comic**: `<folder>/<original name without extension> (<library id>)/<original file name>` (`organizedPath()`, `src/main/services/library-organizer.ts`). The id makes the name unique; the name part is cut so the folder name fits in 255 UTF-8 bytes (`MAX_NAME_BYTES`), which is within the limit of Linux, macOS and Windows.
- **The main process decides every path**: the folder is chosen through a native dialog (`library:pick-organization-folder`) and `settings:set` refuses `libraryOrganizationFolder` (`MAIN_PROCESS_SETTINGS`). An offer reaches the renderer as an opaque token standing for the ids the main process put aside (`library:organize`), like the `comic:pick-file` tokens of [ADR 0011](./0011-ipc-handle-wrapper-and-open-tokens.md): the renderer can't name a file or a destination.
- **A move never loses a file**: `moveFile()` refuses an existing destination, falls back to copy-then-delete across drives (`EXDEV`) and deletes the copy if the original can't be deleted. The library entry is updated (`LibraryRepository.updatePath()`) only after the file moved, and the file is moved back if that update fails. A failure only costs that comic, which stays where it was.
- **The organized folder is watched**: choosing it adds it to `library_folders`, and the resynchronization also walks it whenever the organization is on (`LibraryOrganizer.watchedFolders()`), even if the user forgot it from the list.

## Consequences

- An entry keeps its id, progress, rating, tags, metadata and reading-list places when its file moves; only `path` changes. The cover thumbnail, cached by path, is deleted and regenerated on demand.
- Turning the organization on doesn't move the comics already in the library by itself: only additions are organized, and "Organiser toute la bibliothèque…" moves the others on demand, after a confirmation. A resynchronization and that run never overlap (`LibraryRunLock`).
- The original folders are left in place, even when emptied, except the subfolders of the organized folder itself.
- A book open in the reader while it is moved keeps reading on Linux and macOS; on Windows the move fails (file in use) and is counted as failed.

## Alternatives considered

- **Renaming the file instead of a subfolder per comic** (`<folder>/<name> (<id>).cbz`): simpler, but the subfolder leaves room for sidecar files (a `ComicInfo.xml`, a cover) and for deeper layouts later.
- **Copying instead of moving**: never destructive, but doubles the disk space of the collection, which is what the feature is meant to tidy.
- **Passing the ids to organize from the renderer**: a folder scan can add thousands of comics, beyond the IPC list limit, and the token keeps the renderer from asking to move arbitrary entries.
