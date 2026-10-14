import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (event: unknown, ...raw: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: (event: unknown, ...raw: unknown[]) => unknown) => handlers.set(channel, fn) },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {},
}));

import type { ArchiveInfo, OpenComicResult } from '../../shared/comic';
import { LibraryRepository } from '../db/library-repository';
import { migrate } from '../db/schema';
import { SettingsRepository } from '../db/settings-repository';
import type { DecoderClient } from '../decoder/decoder-client';
import type { ImageStatsScanner } from '../services/image-stats-scanner';
import { COMIC_CHANNELS, registerComicIpc } from './comic';

// Any file that exists: `comic:open` stats the path of the archive it opened.
const FILE = fileURLToPath(import.meta.url);

describe('comic:open', () => {
  const info: ArchiveInfo = { id: 'archive-1', path: FILE, title: 'comic', pageCount: 3, fileCount: 3 };
  const decoder = {
    open: vi.fn(async () => info),
    close: vi.fn(async () => undefined),
    thumbnail: vi.fn(async () => null),
  };
  const notify = vi.fn();
  let library: LibraryRepository;
  let entryId: string;

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    const db = new DatabaseSync(':memory:');
    migrate(db);
    library = new LibraryRepository(db);
    library.register(FILE, 'comic', 3, 3, 1);
    entryId = library.idOfPath(FILE)!;
    registerComicIpc(
      library,
      new SettingsRepository(db),
      decoder as unknown as DecoderClient,
      notify,
      { kick: vi.fn() } as unknown as ImageStatsScanner,
    );
  });

  /** A window (`webContents`) that can be destroyed, with the `destroyed` listeners it was given. */
  function fakeWindow(id = 1) {
    const listeners: Array<() => void> = [];
    return {
      sender: { id, once: (_event: string, listener: () => void) => listeners.push(listener) },
      destroy: () => listeners.forEach((listener) => listener()),
    };
  }
  const openFrom = (window: ReturnType<typeof fakeWindow>, ref: string) =>
    handlers.get(COMIC_CHANNELS.open)!({ sender: window.sender }, ref) as Promise<OpenComicResult>;
  const open = (ref: string) => openFrom(fakeWindow(), ref);

  it('keeps the archive open when the book opens', async () => {
    expect((await open(entryId)).status).toBe('ok');
    expect(decoder.close).not.toHaveBeenCalled();
  });

  it('closes the archive it opened when recording the opening fails', async () => {
    vi.spyOn(library, 'touch').mockImplementation(() => {
      throw new Error('attempt to write a readonly database');
    });
    const result = await open(entryId);
    expect(result.status).toBe('error');
    expect(decoder.close).toHaveBeenCalledWith('archive-1');
  });

  it('does not close anything when the archive itself cannot be opened', async () => {
    decoder.open.mockRejectedValueOnce(new Error('unreadable'));
    expect((await open(entryId)).status).toBe('error');
    expect(decoder.close).not.toHaveBeenCalled();
  });

  it('closes the archives a window left open when it is destroyed', async () => {
    const window = fakeWindow();
    await openFrom(window, entryId);
    expect(decoder.close).not.toHaveBeenCalled();

    window.destroy();
    expect(decoder.close).toHaveBeenCalledWith('archive-1');
  });

  it('does not close an archive the reader already closed when its window is destroyed', async () => {
    const window = fakeWindow();
    await openFrom(window, entryId);
    await handlers.get(COMIC_CHANNELS.close)!({ sender: window.sender }, 'archive-1');
    decoder.close.mockClear();

    window.destroy();
    expect(decoder.close).not.toHaveBeenCalled();
  });
});
