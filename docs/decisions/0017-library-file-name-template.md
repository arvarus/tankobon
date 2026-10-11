# 0017. Library file names: a template of metadata fields

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

[ADR 0016](./0016-library-structure-levels.md) lets the user choose the organized folder's tree, but the files keep the name they arrived with (`tintin_20_scan_HD.cbz`). Users want the organization to rename them too, from the metadata they curate, for example `Tintin - T20 - Tintin au Tibet.cbz`. The request was phrased as a regular expression with named groups (`(?<Series>…) - T(?<Number>…) - (?<Title>…)`), a syntax that reads names rather than writes them.

## Decision

- **A text template with fields**: `AppSettings.libraryFileName` is free text holding `{series}`, `{volume}`, `{title}`, `{year}` and `{author}` (`src/shared/file-name-template.ts`). The file's extension is always kept. The empty template, the default, keeps the original names, so a library already organized doesn't move.
- **Validated like any setting**: `isFileNameTemplate()` refuses a `/` or `\` (folders are the tree's job), a brace outside a known field (a typo such as `{serie}` would otherwise end up in every file name) and more than 200 characters. The settings page keeps an invalid template as a local draft with its error and shows the sample album's name for a valid one.
- **Filled like the levels**: `templatedStem()` (`library-organizer.ts`) takes the values the levels use (the year from `releaseDate`, the author as "Last name First name"), the series and volume as they are; a missing one gives the translated "Unknown". The result goes through `safeFolderName()` and is cut to leave room for the extension. It names the file in both layouts, and the per-comic subfolder of the default layout (`<name> (<id>)`).
- **Same lifecycle as the tree**: changing the template renames nothing by itself; the comics whose name no longer matches count as not in place, and "Organiser toute la bibliothèque…" renames them. Collisions get the ` (<library id>)` suffix of ADR 0016.

## Consequences

- Editing a book's series, volume, title, year or credits makes it "not in place" when the template uses that field, as editing them already does for the levels.
- A template without a field that tells comics apart (`{series}` alone) gives every volume the same name: they get the id-suffixed name instead.
- A case-only rename (`tintin` → `Tintin`) on a case-insensitive file system finds the destination "taken" and falls back to the id-suffixed name.

## Alternatives considered

- **A regular expression with named groups**, as in the request: it describes how to read a name, not how to build one (what does `.+?` produce?), and would also need a separate output pattern. Reading metadata from file names is a different feature.
- **A fixed list of formats**: simpler to validate, but every user names their files a little differently, and the fields cover the variations with one text field.
- **Dropping a missing field together with the text around it** (`Tintin - Tintin au Tibet` with no volume): needs optional sections in the syntax; "Unknown" keeps the template predictable, as the levels do.
