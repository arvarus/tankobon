# Architecture decision records

An ADR records one structural decision: the context, what was decided, and what it costs. ADRs are immutable once accepted: to change a decision, write a new ADR that supersedes the old one and update the old one's status.

| # | Decision | Status |
|---|---|---|
| [0001](./0001-electron-process-isolation.md) | Strict Electron process isolation, one preload bridge | Accepted |
| [0002](./0002-local-storage-node-sqlite.md) | Local storage in a SQLite file through `node:sqlite` | Accepted |
| [0003](./0003-database-location-pointer-file.md) | Database location in a pointer file, never moved automatically | Accepted |
| [0004](./0004-pdf-rendering-pdfjs-napi-canvas.md) | PDF pages rasterized in the main process with pdf.js + `@napi-rs/canvas` | Accepted |
| [0005](./0005-metadata-lookup-public-apis.md) | Book metadata looked up on demand in public APIs, from the main process | Accepted |
| [0006](./0006-bedetheque-album-page-scraping.md) | Bédéthèque album pages read from a pasted link | Accepted |
| [0007](./0007-cover-thumbnails-disk-cache.md) | Cover thumbnails in a disk cache, outside the database | Accepted |
| [0008](./0008-interface-translations-i18next.md) | Interface translations with i18next, locales split by area | Accepted |
| [0009](./0009-ipc-argument-validation.md) | IPC arguments validated in the main process | Accepted |
| [0010](./0010-versioned-migrations.md) | Schema migrations versioned with `PRAGMA user_version` | Accepted |
| [0011](./0011-ipc-handle-wrapper-and-open-tokens.md) | A mandatory `handle()` wrapper for IPC, and opaque tokens instead of paths | Accepted |
| [0012](./0012-decoder-utility-process.md) | Comic files decoded in a utility process, not in the main process | Accepted |
| [0013](./0013-renderer-data-store-data-changed.md) | One renderer data store, kept current by a `data:changed` push | Accepted |
| [0014](./0014-achievements-evaluated-in-renderer.md) | Achievements evaluated in the renderer, only unlocks persisted | Accepted |
| [0015](./0015-library-organization-moves-files.md) | Library organization: the app moves files into one subfolder per comic | Accepted |

These first four ADRs were written after the fact, from the code and its comments, then checked by the maintainer.

## Writing a new ADR

Copy [the template](./template.md) to `NNNN-short-title.md` (next number), fill it in, add it to the table above, and ship it in the same pull request as the change it describes.
