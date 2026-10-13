# 0012. Comic files decoded in a utility process, not in the main process

- **Status:** Accepted (amended by [0018](./0018-decoder-timeouts-and-archive-ownership.md): timeouts on the calls that open a file, archives tied to their window)
- **Date:** 2026-10-03

## Context

Opening a comic means parsing a file the user did not write: a ZIP, a RAR (unrar compiled to WebAssembly), a PDF (pdf.js), then decoding images with `@napi-rs/canvas`, a native addon. All of that ran in the main process, which also owns the window and the database. A booby-trapped or merely broken file could therefore take the whole app down: a PDF declaring a gigantic page was measured at +495 MB, and a bug in a native decoder is a crash with no JavaScript stack to catch. The rasterization also ran on the same event loop as every other IPC call, delaying them.

## Decision

- `ComicService` (the archives kept open by the reader) and `ThumbnailCache` run in a **decoder process**: an Electron `utilityProcess` forked from `src/main/decoder/decoder-worker.ts`, bundled apart as `decoder-worker.cjs` (`vite.decoder.config.mts`, a second `target: 'main'` entry of the Forge Vite plugin).
- The main process talks to it through a `MessageChannelMain` port, with a small request/response protocol (`src/main/decoder/protocol.ts`): every call carries an id, the answer carries the same id and either a result or an already translated error message. `DecoderClient` (`decoder-client.ts`) is the main-side API; the IPC handlers only ever call it. The main process keeps the database, the dialogs and the filesystem walk; it no longer imports any archive code.
- The folder scan stays driven by the main process (it owns `hasPath()`/`register()`): for each unknown file it calls `inspect`, which opens the archive in the decoder process, caches its cover, and returns the page and file counts.
- The process is started on the first call. When it dies, every call waiting for it rejects with a translated "unreadable file" error (`errors:decoder.crashed`), and the next call starts a new one, initialised again with the thumbnails directory and the current language (`applyMainLanguage()` forwards each language change).

## Consequences

- A crash or an out-of-memory kill in a decoder ends that one request (a book that won't open, a cover left out, a file counted as `failed` in a scan), never the app or the database.
- Rendering no longer blocks the main process's other IPC handlers.
- Archives opened in a dead process are gone: the reader's next page request fails with an "unknown archive" error until the book is reopened. Accepted for now: a crash is rare, and reopening restores the position from the library.
- A page crosses the process boundary by structured clone, so its bytes are copied once more (a few MB per page, small next to decoding it; `postMessage` can only transfer ports, not buffers, in a utility process). The renderer still gets them through `ipcMain.handle`, as before.
- The build constraints of the decoders (`unrar.wasm` next to the bundle, `pdfjs-dist` and `@napi-rs/canvas` external and copied into the package, native binaries unpacked from the asar) now apply to `decoder-worker.cjs`; `vite.main.config.mts` only keeps `node:sqlite`. The wasm file and the bundle are in the same folder, so `__dirname`-based lookups are unchanged. In development, `forge.config.ts` restarts the app when `decoder-worker.cjs` is rebuilt too.
- The decoder process has its own i18next instance, like the renderer, switched by the main process.

## Alternatives considered

- **`child_process.fork` or a Node `worker_threads` worker**: a worker thread shares the process, so a native crash or a memory blow-up still takes the app down. `utilityProcess` is Electron's supported way to run Node code in a separate process, with `MessagePort` support.
- **Only wrapping decoders in `try/catch`**: can't catch a native crash or the OS killing a process for memory.
- **The whole scan in the decoder process**: would save a round trip per file but needs the database accessed from both sides, or a callback protocol for each `register()`; the main-driven loop keeps the database in one place.
- **Moving the metadata lookups too**: they parse JSON and HTML from known APIs, not arbitrary user files; out of scope.
