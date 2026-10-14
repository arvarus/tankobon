/**
 * Comic types shared between the main process and the renderer (via preload).
 * @module
 */

/** What `ComicService` knows about an opened archive, before it is matched to a library entry. */
export interface ArchiveInfo {
  /** Opaque handle to the archive, valid until `closeComic`. */
  id: string;
  /** Absolute path on disk. */
  path: string;
  /** File name without extension; in `ComicInfo`, the library title (which the user may have changed). */
  title: string;
  /** Page count (image entries only, sorted in reading order). */
  pageCount: number;
  /** Total entries in the archive (not just image pages). */
  fileCount: number;
}

/** What `comic:open` resolves to: the opened archive merged with its library entry. */
export interface ComicInfo extends ArchiveInfo {
  /** Id of the matching entry in the library database; `null` for an anonymous read (the book isn't in the library). */
  libraryId: string | null;
  /** Page to resume reading at, from the library database (0 for an anonymous read). */
  resumePage: number;
}

/**
 * What `comic:open` resolves to: the opened comic, or a message (in the interface language) saying
 * why the file could not be opened (moved or deleted, unsupported, corrupted…).
 */
export type OpenComicResult = { status: 'ok'; comic: ComicInfo } | { status: 'error'; message: string };

/** One page, as returned by `comic:read-page`. */
export interface ComicPage {
  /** Raw image bytes. */
  data: Uint8Array<ArrayBuffer>;
  /** MIME type inferred from the entry extension. */
  mimeType: string;
}

/** Extensions (without the dot) the app can open: used by the file dialog filter and the folder scanner. */
export const SUPPORTED_COMIC_EXTENSIONS = ['cbz', 'cbr', 'pdf'] as const;

/** Whether a file name has one of the {@link SUPPORTED_COMIC_EXTENSIONS} (case-insensitive). */
export function isSupportedComicFile(fileName: string): boolean {
  return comicFormat(fileName) !== null;
}

/** The format of a comic file: its extension, upper-cased ("CBZ", "CBR", "PDF"). */
export type ComicFormat = Uppercase<(typeof SUPPORTED_COMIC_EXTENSIONS)[number]>;

/**
 * The format of the comic at `path`, read from its extension (case-insensitive), or `null` for an
 * unsupported one. It is derived rather than stored: the extension is what picks the decoder.
 */
export function comicFormat(path: string): ComicFormat | null {
  const extension = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase();
  const known = SUPPORTED_COMIC_EXTENSIONS.find((supported) => supported === extension);
  return known ? (known.toUpperCase() as ComicFormat) : null;
}
