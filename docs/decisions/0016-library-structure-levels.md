# 0016. Library structure: a tree of up to three metadata levels

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

[ADR 0015](./0015-library-organization-moves-files.md) laid the organized folder out as one subfolder per comic, named after the file and its library id, and left "deeper layouts later" open. Users want to browse the organized folder by hand too: by series, by author, by year, with a first-letter grouping once a folder holds hundreds of series. The folder names now come from metadata the user edits, which can be missing, contain characters an OS refuses, or collide.

## Decision

- **A list of levels**: `AppSettings.libraryStructure` is an ordered list of at most three distinct `LibraryLevel`s (`letter`, `year`, `author`, `series`, `album`), checked by `isLibraryStructure()` (`src/shared/settings.ts`), like any setting. `letter` and `year` can only be the first level, and `letter` needs a level after it, whose name's first character it takes (accents dropped and upper-cased; a digit as is; `#` for anything else). The empty list, the default, is ADR 0015's layout, so a library already organized doesn't move.
- **The file goes straight in the last level**, under its original name; when that name is taken there (on disk or by another entry), it becomes `<name> (<library id>).<extension>`. Both names count as "in place" (`organizedPaths()`), so a renamed file isn't moved back and forth, and the ` (<id>)` suffix is dropped again when the file moves to another place.
- **Names come from the entry**: the year from `releaseDate`, the author from the first `writer` credit, else the first credit, as "Last name First name", the series from `series`, else the title (a one-shot is its own series), the album from the title. A missing value gives the translated "Unknown" folder. `safeFolderName()` replaces the characters Windows refuses, trims trailing dots and spaces, suffixes reserved device names and cuts the name to `MAX_NAME_BYTES`.
- **Changing the tree moves nothing by itself**: the comics whose path no longer matches count as not in place, and "Organiser toute la bibliothèque…" moves them, deleting the subfolders of the organized folder it leaves empty, up to the organized folder itself.

## Consequences

- Editing a book's metadata, or changing the interface language (the "Unknown" folder is translated), can make it "not in place"; nothing moves until the next organization of the whole library, or the next addition for the new comics.
- Two homonymous authors, or two series of the same name, share a folder.
- Swapping levels can make a comic's new place the old place of another one: the move picks the id-suffixed name instead, and the comic stays there afterwards.

## Alternatives considered

- **A free-form pattern** (`{letter}/{series}/{title}`): more flexible, but needs a parser, validation messages and escaping rules, for layouts nobody asked for. Three selects cover the requested ones.
- **Skipping a level whose value is missing**: keeps the tree shallower, but puts comics at different depths, which makes a "letter" level ambiguous and the folder harder to browse.
- **Keeping one subfolder per comic under the levels**: no name collision, but one more folder per comic, which is what the levels are meant to avoid.
