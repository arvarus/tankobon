import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import type { ImageScanProgress, LibraryEntry } from '../../shared/library';
import { LibraryRepository } from '../db/library-repository';
import { migrate } from '../db/schema';
import { createImageStatsScanner } from './image-stats-scanner';

function setup(
  measure: (filePath: string) => Promise<{ width: number; height: number } | null>,
  isOnlineOnly?: (filePath: string) => Promise<boolean>,
) {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  const repo = new LibraryRepository(db);
  const progress: ImageScanProgress[] = [];
  const updates: LibraryEntry[][] = [];
  const scanner = createImageStatsScanner(repo, {
    measure,
    isOnlineOnly,
    onProgress: (p) => progress.push(p),
    onUpdated: (entries) => updates.push(entries),
    flushIntervalMs: 0,
  });
  return { repo, scanner, progress, updates };
}

describe('createImageStatsScanner', () => {
  it('never opens a cloud placeholder', async () => {
    const measure = vi.fn(async () => ({ width: 10, height: 10 }));
    const { repo, scanner } = setup(measure, async (filePath) => filePath === '/cloud.cbz');
    repo.register('/cloud.cbz', 'cloud', 10, 10, 1);
    repo.register('/local.cbz', 'local', 10, 10, 1);

    await scanner.kick();

    expect(measure).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledWith('/local.cbz');
    expect(repo.unmeasured().map((e) => e.path)).toEqual(['/cloud.cbz']);
  });

  it('measures the books that have no average yet, and stores it', async () => {
    const { repo, scanner, progress, updates } = setup(async () => ({ width: 1000, height: 1500 }));
    repo.register('/a.cbz', 'a', 10, 10, 1);
    repo.register('/b.cbz', 'b', 10, 10, 1);

    await scanner.kick();

    expect(repo.list().map((e) => [e.avgPageWidth, e.avgPageHeight])).toEqual([
      [1000, 1500],
      [1000, 1500],
    ]);
    expect(updates.flat()).toHaveLength(2);
    expect(progress.at(-1)).toEqual({ running: false, processed: 2, total: 2 });
    expect(progress.some((p) => p.running && p.processed === 1 && p.total === 2)).toBe(true);
    expect(repo.unmeasured()).toEqual([]);
  });

  it('leaves the books it cannot measure empty, and does not retry them within the session', async () => {
    const measure = vi.fn(async (filePath: string) => {
      if (filePath === '/broken.cbz') throw new Error('unreadable');
      return filePath === '/empty.cbz' ? null : { width: 800, height: 1200 };
    });
    const { repo, scanner } = setup(measure);
    repo.register('/broken.cbz', 'broken', 10, 10, 1);
    repo.register('/empty.cbz', 'empty', 10, 10, 1);
    repo.register('/ok.cbz', 'ok', 10, 10, 1);

    await scanner.kick();
    await scanner.kick();

    expect(measure).toHaveBeenCalledTimes(3);
    expect(repo.unmeasured().map((e) => e.path).sort()).toEqual(['/broken.cbz', '/empty.cbz']);
  });

  it('picks up books added while it runs, in the same run', async () => {
    const holder: { repo?: LibraryRepository } = {};
    const measure = vi.fn(async (filePath: string) => {
      if (filePath === '/a.cbz') holder.repo?.register('/late.cbz', 'late', 10, 10, 1);
      return { width: 1, height: 2 };
    });
    const { repo, scanner, progress } = setup(measure);
    holder.repo = repo;
    repo.register('/a.cbz', 'a', 10, 10, 1);

    const first = scanner.kick();
    expect(scanner.kick()).toBe(first);
    await first;

    expect(measure).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toEqual({ running: false, processed: 2, total: 2 });
  });

  it('reports its state through status()', async () => {
    const { repo, scanner } = setup(async () => ({ width: 1, height: 1 }));
    expect(scanner.status()).toEqual({ running: false, processed: 0, total: 0 });
    repo.register('/a.cbz', 'a', 10, 10, 1);
    const run = scanner.kick();
    expect(scanner.status().running).toBe(true);
    await run;
    expect(scanner.status()).toEqual({ running: false, processed: 1, total: 1 });
  });

  it('does nothing for a library that is already measured', async () => {
    const measure = vi.fn();
    const { scanner, progress } = setup(measure);
    await scanner.kick();
    expect(measure).not.toHaveBeenCalled();
    expect(progress.at(-1)).toEqual({ running: false, processed: 0, total: 0 });
  });
});
