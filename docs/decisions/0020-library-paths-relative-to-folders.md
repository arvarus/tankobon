# 0020. Library paths relative to the library folders

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

The library stored each comic's absolute path. The database can live in a synced or shared folder ([ADR 0003](./0003-database-location-pointer-file.md)), and the comics on a network share or a cloud drive are not mounted at the same path on every computer, so a library only worked on the machine that built it.

## Decision

A comic inside a library folder (a scanned folder or the organized one) is stored as `root:<folder id>/<relative path>`; the folder id is in the database, the folder's path on each computer is in a local file (`library-roots.json`, `PathRoots`). Comics outside every folder keep their absolute path. Only `LibraryRepository` sees the stored form. A folder with no path on this computer is listed in Paramètres › Bibliothèque to be located.

## Consequences

- The library opens wherever the folders are mounted, after locating each folder once per computer.
- Forgetting a folder only unwatches it, since stored paths refer to it; moving the organized folder in the settings registers a new root.
- The JSON export still names comics by absolute path.
- Comics added on their own, outside any folder, are still tied to their path.

## Alternatives considered

- **One column of relative paths against a single library root**: breaks as soon as comics come from several folders or from single files.
- **Folder paths in the database**: shared between machines, so every computer would overwrite the others' paths.
