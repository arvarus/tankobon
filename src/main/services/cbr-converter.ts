/**
 * Writing a CBR (RAR) as a CBZ. A RAR can't be written, so the user can't edit one (clean it, rewrite
 * its entries); a CBZ can. The new archive keeps every file of the RAR under its name; the CBR itself
 * is never touched here (the caller decides what becomes of it).
 * @module
 */
import { createWriteStream } from 'node:fs';
import { access, rename, rm } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';

import { t } from '../../shared/i18n';
import { exactArrayBuffer, withExtractor } from './cbr-archive';
import { CbzArchive } from './cbz-archive';
import { isPageEntry, MAX_ENTRY_SIZE, readWholeFile, sortPages } from './comic-archive';

/** What the converted archive holds. */
export interface ConvertedArchive {
  /** Pages of the archive. */
  pageCount: number;
  /** Entries of the archive (pages and the other files). */
  fileCount: number;
}

/**
 * Writes the CBR at `cbrPath` as a CBZ at `cbzPath`. The archive is written beside its destination,
 * checked (same pages, as many entries as the RAR holds) and only then renamed, so a failure at any
 * point leaves no half-written CBZ. Refuses to replace an existing `cbzPath`, an entry above
 * `MAX_ENTRY_SIZE` and a RAR with no image. Directory entries are dropped; pages are stored as they are
 * (already compressed). Entries are extracted one at a time, as yazl asks for them.
 */
export async function convertCbrToCbz(cbrPath: string, cbzPath: string): Promise<ConvertedArchive> {
  const temporary = `${cbzPath}.converting.tmp`;
  const data = exactArrayBuffer(await readWholeFile(cbrPath));
  const files = await withExtractor(data, (extractor) =>
    [...extractor.getFileList().fileHeaders].filter((header) => !header.flags.directory),
  );
  if (!files.some((header) => isPageEntry(header.name))) {
    throw new Error(t('errors:archive.noImages', { path: cbrPath }));
  }
  const tooLarge = files.find((header) => header.unpSize > MAX_ENTRY_SIZE);
  if (tooLarge) throw new Error(t('errors:archive.entryTooLarge', { entry: tooLarge.name }));

  try {
    await rm(temporary, { force: true });
    const out = new ZipFile();
    const written = pipeline(out.outputStream, createWriteStream(temporary));
    for (const header of files) {
      const time = new Date(header.time);
      out.addReadStreamLazy(
        // yazl refuses a backslash in a name; Windows tools write them as separators.
        header.name.replaceAll('\\', '/'),
        { mtime: Number.isNaN(time.getTime()) ? new Date() : time, compress: !isPageEntry(header.name) },
        (callback) => {
          withExtractor(data, (extractor) => [...extractor.extract({ files: [header.name] }).files]).then(
            ([file]) => {
              if (!file?.extraction) return callback(new Error(t('errors:archive.extractFailed', { entry: header.name })), undefined as never);
              const stream = new PassThrough();
              stream.end(Buffer.from(file.extraction));
              callback(null, stream);
            },
            (error: unknown) => callback(error, undefined as never),
          );
        },
      );
    }
    out.end();
    await written;

    const pages = sortPages(files.filter((header) => isPageEntry(header.name)).map((header) => header.name.replaceAll('\\', '/')));
    await verify(temporary, pages, files.length, cbrPath);
    // Checked as late as possible, just before the rename.
    if (await access(cbzPath).then(() => true, () => false)) {
      throw Object.assign(new Error(`${cbzPath} already exists`), { code: 'EEXIST' });
    }
    await rename(temporary, cbzPath);
    return { pageCount: pages.length, fileCount: files.length };
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/** Checks the new archive opens and holds the RAR's pages, in order, and `fileCount` entries. */
async function verify(archivePath: string, pages: string[], fileCount: number, original: string): Promise<void> {
  const archive = await CbzArchive.open(archivePath);
  try {
    const same = archive.pages.length === pages.length && archive.pages.every((page, i) => page === pages[i]);
    if (!same || archive.fileCount !== fileCount) {
      throw new Error(t('errors:archive.convertVerifyFailed', { path: original }));
    }
  } finally {
    await archive.close();
  }
}
