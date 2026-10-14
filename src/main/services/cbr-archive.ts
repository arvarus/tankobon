/**
 * CBR (RAR) support.
 * @module
 */
import { createExtractorFromData, type Extractor } from 'node-unrar-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ComicPage } from '../../shared/comic';
import { t } from '../../shared/i18n';
import { imageMimeType, isPageEntry, MAX_ENTRY_SIZE, sortPages, type ComicArchive } from './comic-archive';
import { checkedPage } from './image-size';

// The Emscripten-compiled wasm module is copied next to the bundled decoder-worker.cjs (see
// vite.decoder.config.mts): loaded once and reused for every archive opened.
let wasmBinary: ArrayBuffer | undefined;
async function getWasmBinary(): Promise<ArrayBuffer> {
  wasmBinary ??= Uint8Array.from(await readFile(join(__dirname, 'unrar.wasm'))).buffer;
  return wasmBinary;
}

// node-unrar-js runs every extractor through one shared wasm module, which only knows the most
// recently *created* extractor (`createExtractorFromData` sets a module-wide pointer to it). An
// extractor kept alive and reused after another archive was opened (a second book, a folder scan)
// would feed the wasm the other archive's bytes: "File is not RAR archive", then a TypeError. So an
// archive keeps only its bytes, and every operation creates its own extractor and uses it up
// synchronously, one at a time, so that no other creation can slip in between.
let queue: Promise<unknown> = Promise.resolve();
function withExtractor<T>(data: ArrayBuffer, use: (extractor: Extractor<Uint8Array>) => T): Promise<T> {
  const run = queue.then(async () => {
    const extractor = await createExtractorFromData({ data, wasmBinary: await getWasmBinary() });
    return use(extractor);
  });
  queue = run.catch(() => undefined);
  return run;
}

/**
 * A `.cbr` (RAR) comic, read with node-unrar-js (unrar compiled to WebAssembly). The whole file is
 * loaded in memory when opened.
 */
export class CbrArchive implements ComicArchive {
  private constructor(
    readonly path: string,
    readonly pages: readonly string[],
    readonly fileCount: number,
    private readonly data: ArrayBuffer,
    private readonly sizes: ReadonlyMap<string, number>,
  ) {}

  /** Reads and indexes the archive; throws when it holds no image. */
  static async open(filePath: string): Promise<CbrArchive> {
    const data = Uint8Array.from(await readFile(filePath)).buffer;
    // The generator must be drained fully, or the underlying archive handle leaks.
    const files = await withExtractor(data, (extractor) =>
      [...extractor.getFileList().fileHeaders].filter((header) => !header.flags.directory),
    );
    const pages = sortPages(files.filter((header) => isPageEntry(header.name)).map((header) => header.name));
    if (pages.length === 0) {
      throw new Error(t('errors:archive.noImages', { path: filePath }));
    }
    const sizes = new Map(files.map((header) => [header.name, header.unpSize]));
    return new CbrArchive(filePath, pages, files.length, data, sizes);
  }

  /** Extracts page `index` (0-based); throws a `RangeError` when out of range. */
  async readPage(index: number): Promise<ComicPage> {
    const entryName = this.pages[index];
    if (entryName === undefined) {
      throw new RangeError(t('errors:archive.pageOutOfRange', { index, last: this.pages.length - 1 }));
    }
    // A few kilobytes of RAR can unpack to gigabytes: the size the header declares is checked before extracting.
    if ((this.sizes.get(entryName) ?? 0) > MAX_ENTRY_SIZE) {
      throw new Error(t('errors:archive.entryTooLarge', { entry: entryName }));
    }
    // Drained fully here too, for the same reason as in open().
    const [file] = await withExtractor(this.data, (extractor) => [...extractor.extract({ files: [entryName] }).files]);
    if (!file?.extraction) {
      throw new Error(t('errors:archive.extractFailed', { entry: entryName }));
    }
    // Copy into a fresh ArrayBuffer: the extraction may be a view on a shared/wasm buffer.
    return checkedPage({ data: new Uint8Array(file.extraction), mimeType: imageMimeType(entryName)! }, entryName);
  }

  /** Nothing to release: the archive lives in memory. */
  close(): Promise<void> {
    // In-memory archive: nothing to release (no open file handle to the archive itself).
    return Promise.resolve();
  }
}
