import { describe, expect, it, vi } from 'vitest';

import type { DataChange } from '@/shared/data-changes';
import type { LibraryEntry } from '@/shared/library';
import type { ReadingList } from '@/shared/reading-list';
import { DEFAULT_SETTINGS, toPublicSettings } from '@/shared/settings';

import { applyLibraryChange, DataStore, type DataSource } from './data-store';

function entry(id: string, lastOpenedAt: string, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    path: `/${id}.cbz`,
    title: id,
    pageCount: 10,
    currentPage: 0,
    addedAt: lastOpenedAt,
    lastOpenedAt,
    fileCount: 10,
    fileSize: 1,
    rating: 0,
    tags: [],
    titleLocked: false,
    series: null,
    volume: null,
    releaseDate: null,
    language: null,
    avgPageWidth: null,
    avgPageHeight: null,
    credits: [],
    ...extra,
  };
}

const ids = (entries: LibraryEntry[]) => entries.map((e) => e.id);

describe('applyLibraryChange', () => {
  const library = [entry('c', '2026-03'), entry('b', '2026-02'), entry('a', '2026-01')];

  it('replaces an entry in place when its opening date is unchanged', () => {
    const result = applyLibraryChange(library, { scope: 'library', upserted: [entry('b', '2026-02', { rating: 4 })] });
    expect(ids(result)).toEqual(['c', 'b', 'a']);
    expect(result[1].rating).toBe(4);
    expect(library[1].rating).toBe(0);
  });

  it('moves an entry that was just opened to the front', () => {
    const result = applyLibraryChange(library, { scope: 'library', upserted: [entry('a', '2026-04')] });
    expect(ids(result)).toEqual(['a', 'c', 'b']);
  });

  it('puts a new entry where its date places it', () => {
    expect(ids(applyLibraryChange(library, { scope: 'library', upserted: [entry('n', '2026-02-15')] }))).toEqual([
      'c',
      'n',
      'b',
      'a',
    ]);
    expect(ids(applyLibraryChange(library, { scope: 'library', upserted: [entry('old', '2025-01')] }))).toEqual([
      'c',
      'b',
      'a',
      'old',
    ]);
  });

  it('drops removed entries', () => {
    expect(ids(applyLibraryChange(library, { scope: 'library', removed: ['b', 'zzz'] }))).toEqual(['c', 'a']);
  });

  it('returns the same array when nothing changes', () => {
    expect(applyLibraryChange(library, { scope: 'library', upserted: [] })).toBe(library);
  });
});

function fakeSource(overrides: Partial<{ library: LibraryEntry[]; lists: ReadingList[] }> = {}) {
  let listener: (change: DataChange) => void = () => undefined;
  const source = {
    library: { list: vi.fn(async () => overrides.library ?? []) },
    readingLists: { list: vi.fn(async () => overrides.lists ?? []) },
    achievements: { list: vi.fn(async () => []) },
    settings: { getAll: vi.fn(async () => ({ ...toPublicSettings(DEFAULT_SETTINGS), pageSpacing: 7 })) },
    data: {
      onChanged: (l: (change: DataChange) => void) => {
        listener = l;
        return () => undefined;
      },
    },
  } satisfies DataSource;
  return { source, emit: (change: DataChange) => listener(change) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DataStore', () => {
  it('loads everything once started, and only once', async () => {
    const { source } = fakeSource({ library: [entry('a', '2026-01')] });
    const store = new DataStore(source);
    expect(store.getLibrary()).toBeNull();
    store.start();
    store.start();
    await store.ready;
    await flush();
    expect(store.getLibrary()).toHaveLength(1);
    expect(store.getReadingLists()).toEqual([]);
    expect(store.getSettings().pageSpacing).toBe(7);
    expect(source.library.list).toHaveBeenCalledTimes(1);
  });

  it('applies targeted library changes without reloading, and reloads on an untargeted one', async () => {
    const { source, emit } = fakeSource({ library: [entry('a', '2026-01')] });
    const store = new DataStore(source);
    store.start();
    await flush();
    emit({ scope: 'library', upserted: [entry('a', '2026-01', { rating: 5 })] });
    expect(store.getLibrary()?.[0].rating).toBe(5);
    expect(source.library.list).toHaveBeenCalledTimes(1);
    emit({ scope: 'library' });
    await flush();
    expect(source.library.list).toHaveBeenCalledTimes(2);
  });

  it('reloads the reading lists and the settings on their changes', async () => {
    const { source, emit } = fakeSource();
    const store = new DataStore(source);
    store.start();
    await flush();
    emit({ scope: 'readingLists' });
    emit({ scope: 'settings' });
    await flush();
    expect(source.readingLists.list).toHaveBeenCalledTimes(2);
    expect(source.settings.getAll).toHaveBeenCalledTimes(2);
  });

  it('notifies only the subscribers of the slice that changed', async () => {
    const { source, emit } = fakeSource({ library: [entry('a', '2026-01')] });
    const store = new DataStore(source);
    store.start();
    await flush();
    const onLibrary = vi.fn();
    const onSettings = vi.fn();
    store.subscribe('library', onLibrary);
    const unsubscribe = store.subscribe('settings', onSettings);
    emit({ scope: 'library', removed: ['a'] });
    expect(onLibrary).toHaveBeenCalledTimes(1);
    expect(onSettings).not.toHaveBeenCalled();
    unsubscribe();
    emit({ scope: 'settings', values: { pageSpacing: 1 } });
    expect(onSettings).not.toHaveBeenCalled();
  });

  it('ignores the echo of a write still pending, then accepts later changes', async () => {
    const { source, emit } = fakeSource({ library: [entry('a', '2026-01')] });
    const store = new DataStore(source);
    store.start();
    await flush();

    let finish: () => void = () => undefined;
    const write = store.patchEntry('a', { rating: 3 }, () => new Promise<void>((resolve) => (finish = resolve)));
    expect(store.getLibrary()?.[0].rating).toBe(3);
    // The echo of an earlier write arrives while a newer one is in flight.
    emit({ scope: 'library', upserted: [entry('a', '2026-01', { rating: 2 })] });
    expect(store.getLibrary()?.[0].rating).toBe(3);
    finish();
    await write;
    emit({ scope: 'library', upserted: [entry('a', '2026-01', { rating: 4 })] });
    expect(store.getLibrary()?.[0].rating).toBe(4);
  });

  it('updates a setting at once and ignores its echo while the write is pending', async () => {
    const { source, emit } = fakeSource();
    const store = new DataStore(source);
    store.start();
    await store.ready;
    let finish: () => void = () => undefined;
    const write = store.updateSetting('pageSpacing', 20, () => new Promise<void>((resolve) => (finish = resolve)));
    expect(store.getSettings().pageSpacing).toBe(20);
    emit({ scope: 'settings', values: { pageSpacing: 12 } });
    expect(store.getSettings().pageSpacing).toBe(20);
    finish();
    await write;
    emit({ scope: 'settings', values: { pageSpacing: 30 } });
    expect(store.getSettings().pageSpacing).toBe(30);
  });

  it('drops an optimistic entry change when the write is refused', async () => {
    const { source } = fakeSource({ library: [entry('a', '2026-01')] });
    const store = new DataStore(source);
    store.start();
    await flush();

    await expect(
      store.patchEntry('a', { rating: 5 }, () => Promise.reject(new Error('database is locked'))),
    ).rejects.toThrow('database is locked');
    expect(store.getLibrary()?.[0].rating).toBe(0);
    expect(source.library.list).toHaveBeenCalledTimes(2);
  });

  it('drops an optimistic setting when the write is refused', async () => {
    const { source } = fakeSource();
    const store = new DataStore(source);
    store.start();
    await store.ready;

    await expect(
      store.updateSetting('pageSpacing', 20, () => Promise.reject(new Error('refused'))),
    ).rejects.toThrow('refused');
    expect(store.getSettings().pageSpacing).toBe(7);
  });

  it('adds newly earned achievements once, and notifies its own slice', async () => {
    const { source, emit } = fakeSource();
    const store = new DataStore(source);
    store.start();
    await flush();
    const listener = vi.fn();
    store.subscribe('achievements', listener);
    const firstBook = { id: 'firstBook', unlockedAt: '2026-01-01T00:00:00.000Z' } as const;
    emit({ scope: 'achievements', unlocked: [firstBook] });
    emit({ scope: 'achievements', unlocked: [firstBook] });
    expect(store.getAchievements()).toEqual([firstBook]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
