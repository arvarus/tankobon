/**
 * Library types shared between the main process and the renderer (via preload).
 * @module
 */

/**
 * The tag that marks a book as read, also one of the library page's quick tags. It is stored as
 * is whatever the interface language (existing libraries and exports carry it); only its label
 * is translated.
 */
export const READ_TAG = 'Lu';

/** A comic registered in the local library database. */
export interface LibraryEntry {
  id: string;
  /** Absolute path on disk. */
  path: string;
  title: string;
  pageCount: number;
  /** Last page read, for resuming where the user left off. */
  currentPage: number;
  /** ISO timestamps. */
  addedAt: string;
  lastOpenedAt: string;
  /** Total entries in the archive (not just image pages). */
  fileCount: number;
  /** Size in bytes of the archive file on disk. */
  fileSize: number;
  /** User rating, 0 (unrated) to 5. */
  rating: number;
  /** Free-form user labels, e.g. "Lu", "À lire". */
  tags: string[];
  /**
   * Whether `title` was set by the user (accepted from a metadata lookup or typed in the edit form)
   * rather than derived from the file name. A locked title survives reopening the file, which
   * otherwise refreshes it.
   */
  titleLocked: boolean;
  /** Series the book belongs to ("Tintin", "X-Men"), null when unknown or a one-shot. */
  series: string | null;
  /** Volume or issue number within `series`, as text ("3", "12.1", "HS"). Null for one-shots. */
  volume: string | null;
  /** Release date as precise as known: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  releaseDate: string | null;
  /** Language of the book, as an ISO 639-1 code ("fr", "en"). */
  language: string | null;
  /**
   * Simple average width of the pages' images, in pixels, once the background scan has measured
   * the book (see `ImageScanProgress`); null until then. For a PDF, the size pages are rendered at.
   */
  avgPageWidth: number | null;
  /** Simple average height of the pages' images, in pixels; null until measured. */
  avgPageHeight: number | null;
  /** People credited on the book, with their role. */
  credits: Credit[];
}

/**
 * What a person did on a book. `author` is for sources that don't say (Google Books lists
 * "authors" without telling the writer from the artist).
 */
export type CreditRole = 'writer' | 'artist' | 'colorist' | 'inker' | 'letterer' | 'cover' | 'author';

/** Every `CreditRole`, in display order. */
export const CREDIT_ROLES: readonly CreditRole[] = [
  'writer',
  'artist',
  'colorist',
  'inker',
  'letterer',
  'cover',
  'author',
];

/** A person, as identified by name. `firstName` is empty for a single-word name or pen name ("Hergé"). */
export interface PersonName {
  firstName: string;
  lastName: string;
}

/** A person credited on a book: one row of the `credits` table joined with `people`. */
export interface Credit extends PersonName {
  /** Id of the row in the `people` table; the same person shares it across books. */
  personId: string;
  role: CreditRole;
}

/** A credit as written by `library.updateMetadata()`: people are matched (or created) by name. */
export interface CreditInput extends PersonName {
  role: CreditRole;
}

/**
 * Metadata fields to write on a library entry with `library.updateMetadata()`. Only the fields
 * present are changed; `credits`, when present, replaces the entry's whole credit list.
 */
export interface MetadataUpdate {
  /** Replaces the title and locks it (see `LibraryEntry.titleLocked`). */
  title?: string;
  series?: string | null;
  volume?: string | null;
  releaseDate?: string | null;
  language?: string | null;
  credits?: CreditInput[];
}

/** Outcome of `library.addFile()`. */
export type AddFileResult =
  | { status: 'cancelled' }
  /** The comic was added to the library; the reader is not opened. */
  | { status: 'added'; title: string; organization: OrganizationOutcome }
  /** The comic was already in the library, and is left untouched. */
  | { status: 'exists'; title: string }
  /** The file can't be opened (corrupted, unsupported…); `message` is in the interface language. */
  | { status: 'error'; message: string };

/** Progress of a folder scan, pushed from the main process while it runs. */
export interface ScanProgress {
  /** `scanning`: walking the tree, `total` not known yet. `importing`: opening each file found. */
  phase: 'scanning' | 'importing' | 'done';
  processed: number;
  total: number;
  /** Absolute path currently being handled, for the progress label. */
  currentFile: string;
}

/**
 * State of the background scan that measures the pages of the library's books, pushed from the
 * main process while it runs (and returned by `library.imageScanStatus()`).
 */
export interface ImageScanProgress {
  /** Whether books are being measured; false once the queue is empty. */
  running: boolean;
  /** Books measured (or given up on) since the scan started. */
  processed: number;
  /** Books to measure in this run, those added while it runs included. */
  total: number;
}

/** Outcome of `library.addFolder()`. */
export type ScanResult =
  | { status: 'cancelled' }
  | {
      status: 'ok';
      directory: string;
      /** Comics added to the library. */
      added: number;
      /** Comics already in the library, left untouched. */
      skipped: number;
      /** Files that couldn't be opened (corrupt, unsupported variant…). */
      failed: number;
      /** Supported files found in the tree, i.e. `added + skipped + failed`. */
      total: number;
      /** What the library organization did with the comics added. */
      organization: OrganizationOutcome;
    };

/** Outcome of `library.resync()`. */
export type ResyncResult =
  | {
      status: 'ok';
      /** Comics added to the library. */
      added: number;
      /** Comics removed because their file no longer exists. */
      removed: number;
      /** Files that couldn't be opened. */
      failed: number;
      /** Folders that couldn't be read, left untouched. */
      unreachable: number;
      /** When it finished (ISO 8601); also stored as the `lastResyncAt` setting. */
      finishedAt: string;
      /** What the library organization did with the comics added. */
      organization: OrganizationOutcome;
    }
  | { status: 'error'; message: string };

/**
 * What the library organization (`AppSettings.libraryOrganization`) did with the comics an addition
 * (a file, a folder, a resynchronization) brought into the library.
 */
export interface OrganizationOutcome {
  /** Comics moved into the organized folder right away. */
  moved: number;
  /** Comics whose move failed: they stay where they were, still in the library. */
  failed: number;
  /**
   * In `ask` mode, the comics to offer to move: `token` stands for them in `library.organize()`,
   * `count` is how many, `folder` the organized folder. Null when there is nothing to offer.
   */
  pending: { token: string; count: number; folder: string } | null;
}

/** Result of `library.organize()` and `library.organizeAll()`; an error (no organized folder, folder unreachable, unknown token) has a translated `message`. */
export type OrganizeResult = { status: 'ok'; moved: number; failed: number } | { status: 'error'; message: string };

/** Result of `library.countUnorganized()`: how many library comics aren't in their place in the organized `folder` yet. */
export type UnorganizedCountResult = { status: 'ok'; count: number; folder: string } | { status: 'error'; message: string };

/** A library folder that has no path on this machine yet, because the library comes from another one. */
export interface UnlinkedFolder {
  id: string;
  /** The path it had where it was added, to recognize it. */
  path: string;
}

/** Result of `library.relinkFolder()`. */
export type RelinkFolderResult = { status: 'cancelled' } | { status: 'ok' } | { status: 'error'; message: string };

/** Result of `library.pickOrganizationFolder()`. */
export type PickOrganizationFolderResult = { status: 'cancelled' } | { status: 'ok'; folder: string };
