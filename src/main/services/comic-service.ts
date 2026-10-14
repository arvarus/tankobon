/**
 * Keeps opened archives alive between IPC calls, addressed by an opaque id.
 * @module
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { ArchiveInfo, ComicPage } from '../../shared/comic';
import { t } from '../../shared/i18n';
import { CbrArchive } from './cbr-archive';
import { CbzArchive } from './cbz-archive';
import type { ComicArchive } from './comic-archive';
import { PdfArchive } from './pdf-archive';

const openers: Record<string, (filePath: string) => Promise<ComicArchive>> = {
  '.cbz': CbzArchive.open,
  '.cbr': CbrArchive.open,
  '.pdf': PdfArchive.open,
};

/**
 * Opens a single archive, without registering it anywhere. Shared with the folder scanner
 * (`library-scanner.ts`), which opens each file it finds just long enough to read its page count
 * and closes it again — it has no use for `ComicService`'s keep-alive map.
 */
export async function openArchive(filePath: string): Promise<ComicArchive> {
  const ext = path.extname(filePath).toLowerCase();
  const opener = openers[ext];
  if (!opener) {
    throw new Error(t('errors:archive.unsupportedFormat', { extension: ext || t('errors:archive.noExtension') }));
  }
  return opener(filePath);
}

/**
 * Most archives kept open at once. Past it, the one opened longest ago is closed to make room: a
 * reader that is gone without closing its book (a crashed renderer) can't pile archives up (a CBR
 * keeps its whole file in memory), and no reader has eight books open at once.
 */
export const MAX_OPEN_ARCHIVES = 8;

/**
 * Registry of the archives currently open in the reader. Each gets a `randomUUID()` handle, distinct
 * from the persistent library id stored in the database.
 */
export class ComicService {
  private readonly archives = new Map<string, ComicArchive>();

  /** Opens a file (format picked by extension) and keeps it open until `close`. */
  async open(filePath: string): Promise<ArchiveInfo> {
    const archive = await openArchive(filePath);
    const id = randomUUID();
    this.archives.set(id, archive);
    // A Map iterates in insertion order: the first key is the oldest.
    while (this.archives.size > MAX_OPEN_ARCHIVES) {
      await this.close(this.archives.keys().next().value as string);
    }
    return {
      id,
      path: filePath,
      title: path.basename(filePath, path.extname(filePath)),
      pageCount: archive.pages.length,
      fileCount: archive.fileCount,
    };
  }

  /** Reads a page of an open archive; throws for an unknown id. */
  readPage(id: string, index: number): Promise<ComicPage> {
    return this.get(id).readPage(index);
  }

  /** Closes and forgets an archive; does nothing for an unknown id. */
  async close(id: string): Promise<void> {
    const archive = this.archives.get(id);
    if (archive) {
      this.archives.delete(id);
      await archive.close();
    }
  }

  /** Closes every open archive (on app quit). */
  async closeAll(): Promise<void> {
    await Promise.all([...this.archives.keys()].map((id) => this.close(id)));
  }

  private get(id: string): ComicArchive {
    const archive = this.archives.get(id);
    if (!archive) {
      throw new Error(t('errors:archive.unknown', { id }));
    }
    return archive;
  }
}
