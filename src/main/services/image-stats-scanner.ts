/**
 * The background scan that measures the pages of the library's books (average width and height),
 * one book at a time, so that nothing waits for it.
 * @module
 */
import type { ImageScanProgress, LibraryEntry } from '../../shared/library';
import type { LibraryRepository } from '../db/library-repository';
import type { PageSizeAverage } from '../decoder/protocol';

/** Starts and reports the background measure of the library's pages. */
export interface ImageStatsScanner {
  /**
   * Measures every book that has not been yet. Does nothing more when a run is already going: it
   * looks for new books again before it ends. Resolves when the queue is empty; never rejects.
   */
  kick(): Promise<void>;
  /** Where the scan is now, for a window that opens (or loads) while it runs. */
  status(): ImageScanProgress;
}

/** How the scanner reaches the rest of the app. */
export interface ImageStatsScannerOptions {
  /** Averages a file's page sizes (the decoder process's `measure`); null when none could be read. */
  measure: (filePath: string) => Promise<PageSizeAverage | null>;
  /**
   * Whether a file is a cloud placeholder (reading it would download it). Such books are left for
   * later in the session: they are measured once opened. Defaults to never.
   */
  isOnlineOnly?: (filePath: string) => Promise<boolean>;
  /** Called as the scan advances. */
  onProgress: (progress: ImageScanProgress) => void;
  /** Called with the entries just updated, at most once per `flushIntervalMs` and when the run ends. */
  onUpdated: (entries: LibraryEntry[]) => void;
  /** Spacing of `onUpdated` calls, so a large library doesn't send one message per book. Defaults to 500 ms. */
  flushIntervalMs?: number;
}

/**
 * Builds the scanner. A book that can't be measured (unreadable, or no page whose size is known)
 * is skipped for the rest of the session and tried again at the next start: its columns stay null.
 */
export function createImageStatsScanner(repo: LibraryRepository, options: ImageStatsScannerOptions): ImageStatsScanner {
  const { measure, isOnlineOnly = async () => false, onProgress, onUpdated, flushIntervalMs = 500 } = options;
  const gaveUp = new Set<string>();
  let progress: ImageScanProgress = { running: false, processed: 0, total: 0 };
  let current: Promise<void> | undefined;

  const report = (next: ImageScanProgress) => {
    progress = next;
    onProgress(progress);
  };

  async function run(): Promise<void> {
    let processed = 0;
    let updated: LibraryEntry[] = [];
    let lastFlush = Date.now();
    const flush = () => {
      if (updated.length > 0) {
        onUpdated(updated);
        updated = [];
      }
      lastFlush = Date.now();
    };

    try {
      for (;;) {
        // Looked up again once the queue is empty: books added meanwhile are measured in the same run.
        const queue = repo.unmeasured().filter((entry) => !gaveUp.has(entry.id));
        if (queue.length === 0) break;
        const total = processed + queue.length;
        report({ running: true, processed, total });

        for (const entry of queue) {
          try {
            if (await isOnlineOnly(entry.path)) {
              gaveUp.add(entry.id);
              processed += 1;
              report({ running: true, processed, total });
              continue;
            }
            const average = await measure(entry.path);
            const saved = average ? repo.updateImageStats(entry.id, average.width, average.height) : null;
            if (saved) updated.push(saved);
            else if (!average) gaveUp.add(entry.id);
          } catch {
            gaveUp.add(entry.id);
          }
          processed += 1;
          report({ running: true, processed, total });
          if (Date.now() - lastFlush >= flushIntervalMs) flush();
        }
      }
    } finally {
      flush();
      report({ running: false, processed, total: processed });
    }
  }

  return {
    kick() {
      current ??= run().finally(() => {
        current = undefined;
      });
      return current;
    },
    status: () => progress,
  };
}
