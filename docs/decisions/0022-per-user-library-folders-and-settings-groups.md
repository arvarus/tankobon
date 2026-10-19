# 0022. Watched folders per user, and settings split in two groups

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

[ADR 0019](./0019-multiple-users.md) made several users share one library, with the folders, their resynchronization and the library's organization all common. In practice each person keeps their own copy of the comics on their own drive or share, and one settings page mixed what is personal with what concerns everyone.

## Decision

- **Which folders a resynchronization walks is personal**: `user_library_folders` (migration 9) links a user to the library folders they watch. `library_folders` stays common, since books are recorded relative to a folder id ([ADR 0020](./0020-library-paths-relative-to-folders.md)). `resyncOnStartup`, `lastResyncAt` and the organized folder (`libraryOrganizationFolder`) leave `SHARED_SETTINGS`; the layout of the organization (mode, tree, file name) stays shared.
- **The settings menu has two groups**: "Utilisateur" (Accueil, Affichage, Lecteur, Bibliothèque: personal settings) and "Bibliothèque partagée" (Organisation, Métadonnées, Données). "À propos" is not a setting: it is its own sidebar entry and route (`/about`).
- The startup choice of user stays shared, since it is read before anyone is chosen; it is shown in Affichage.

## Consequences

- Removing a folder for one user keeps it for the others; deleting a user removes their watched folders.
- A resynchronization removes missing books from the library for everyone, but only walks the active user's folders: books under folders only another user watches are checked like standalone files (removed only when their file is gone while its directory is readable).
- Existing users keep what they had: migration 9 gives every user the folders that were watched, and migration 7 had already copied all the settings to the first user.

## Alternatives considered

- **Keep everything shared and only reorganize the pages**: simpler, but the folders of one user would be walked and organized for all.
