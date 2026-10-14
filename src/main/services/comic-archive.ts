/**
 * Comic archive abstraction. Each format (CBZ, CBR, PDF) implements `ComicArchive`;
 * the rest of the app only deals with page indexes.
 * @module
 */
import path from 'node:path';

import type { ComicPage } from '../../shared/comic';
import type { ImageSize } from './image-size';

/** An opened comic file, whatever its format. */
export interface ComicArchive {
  readonly path: string;
  /** Image entry names, sorted in reading order. */
  readonly pages: readonly string[];
  /** Total entries in the archive (not just image pages). */
  readonly fileCount: number;
  /** Reads page `index` (0-based, in `pages` order); rejects with a `RangeError` when out of range. */
  readPage(index: number): Promise<ComicPage>;
  /**
   * Size in pixels of page `index`, when the archive can tell without reading the whole page
   * (a PDF knows it from the page's box). Absent for the formats whose pages are image files:
   * the measure then reads their headers.
   */
  pageSize?(index: number): Promise<ImageSize | null>;
  /** Releases the underlying resources; the archive must not be used afterwards. */
  close(): Promise<void>;
}

/** Largest page entry read into memory (200 MB, uncompressed size declared by the archive). */
export const MAX_ENTRY_SIZE = 200 * 1024 * 1024;

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
};

/** MIME type of an image entry from its extension, or undefined when it is not a supported image. */
export function imageMimeType(entryName: string): string | undefined {
  return IMAGE_MIME_TYPES[path.extname(entryName).toLowerCase()];
}

/** Hidden files and macOS resource forks (`__MACOSX/._page.jpg`) are not pages. */
export function isPageEntry(entryName: string): boolean {
  const base = path.posix.basename(entryName);
  return !base.startsWith('.') && !entryName.startsWith('__MACOSX/') && imageMimeType(entryName) !== undefined;
}

/** Natural sort so `page2.jpg` comes before `page10.jpg`. */
export function sortPages(entryNames: string[]): string[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...entryNames].sort(collator.compare);
}
