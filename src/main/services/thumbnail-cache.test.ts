import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ComicPage } from '../../shared/comic';
import type { ComicArchive } from './comic-archive';
import { coverSidecarPath } from './cover-sidecar';
import {
  renderThumbnail,
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_MAX_WIDTH,
  ThumbnailCache,
  thumbnailKey,
} from './thumbnail-cache';

async function png(width: number, height: number): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#c0392b';
  context.fillRect(0, 0, width, height);
  return new Uint8Array(await canvas.encode('png'));
}

async function size(bytes: Uint8Array): Promise<[number, number]> {
  const image = await loadImage(Buffer.from(bytes));
  return [image.width, image.height];
}

/** An in-memory archive whose pages are PNGs; counts how often it is opened and read. */
function fakeOpener(pages: Record<string, ComicPage[]>) {
  const calls = { opened: 0, read: 0, closed: 0 };
  const open = async (filePath: string): Promise<ComicArchive> => {
    const content = pages[filePath];
    if (!content) throw new Error(`ENOENT: ${filePath}`);
    calls.opened += 1;
    return {
      path: filePath,
      pages: content.map((_, index) => `${index}.png`),
      fileCount: content.length,
      readPage: async (index) => {
        calls.read += 1;
        return content[index];
      },
      close: async () => {
        calls.closed += 1;
      },
    };
  };
  return { open, calls };
}

describe('renderThumbnail', () => {
  it('refuses an image declaring huge dimensions without decoding it', async () => {
    const header = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
    header.write('IHDR', 12, 'ascii');
    header.writeUInt32BE(30_000, 16);
    header.writeUInt32BE(30_000, 20);
    await expect(renderThumbnail(header)).rejects.toThrow('30000');
  });

  it('fits a large page into the bounding box, keeping its aspect ratio', async () => {
    const [width, height] = await size(await renderThumbnail(await png(1200, 1800)));
    expect(width).toBe(THUMBNAIL_MAX_WIDTH);
    expect(height).toBe(THUMBNAIL_MAX_HEIGHT);

    const [wideWidth, wideHeight] = await size(await renderThumbnail(await png(2400, 1200)));
    expect(wideWidth).toBe(THUMBNAIL_MAX_WIDTH);
    expect(wideHeight).toBe(THUMBNAIL_MAX_WIDTH / 2);
  });

  it('never enlarges a small image', async () => {
    expect(await size(await renderThumbnail(await png(100, 150)))).toEqual([100, 150]);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(renderThumbnail(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});

describe('thumbnailKey', () => {
  it('is stable per path and differs between paths', () => {
    expect(thumbnailKey('/bd/a.cbz')).toBe(thumbnailKey('/bd/a.cbz'));
    expect(thumbnailKey('/bd/a.cbz')).not.toBe(thumbnailKey('/bd/b.cbz'));
  });
});

describe('ThumbnailCache', () => {
  let dir: string;
  let cover: ComicPage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tankobon-thumbs-'));
    cover = { data: await png(600, 900), mimeType: 'image/png' };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('generates a missing thumbnail from the first page, then serves it from disk', async () => {
    const { open, calls } = fakeOpener({ '/bd/a.cbz': [cover, { data: await png(10, 10), mimeType: 'image/png' }] });
    const cache = new ThumbnailCache(dir, open);

    expect(await cache.read('/bd/a.cbz')).toBeNull();
    const generated = await cache.ensure('/bd/a.cbz');
    expect(generated).not.toBeNull();
    expect(await size(generated!)).toEqual([THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT]);
    expect(calls).toEqual({ opened: 1, read: 1, closed: 1 });

    expect(await cache.ensure('/bd/a.cbz')).toEqual(generated);
    expect(await new ThumbnailCache(dir, open).read('/bd/a.cbz')).toEqual(generated);
    expect(calls.opened).toBe(1);
  });

  it('shares one generation between concurrent requests for the same book', async () => {
    const { open, calls } = fakeOpener({ '/bd/a.cbz': [cover] });
    const cache = new ThumbnailCache(dir, open);

    const [first, second] = await Promise.all([cache.ensure('/bd/a.cbz'), cache.ensure('/bd/a.cbz')]);
    expect(first).toEqual(second);
    expect(calls.opened).toBe(1);
  });

  it('uses the page reader it is given instead of opening the file', async () => {
    const { open, calls } = fakeOpener({});
    const cache = new ThumbnailCache(dir, open);

    expect(await cache.ensure('/bd/open.cbz', async () => cover)).not.toBeNull();
    expect(calls.opened).toBe(0);
  });

  it('caches from an archive the caller has open, without closing it', async () => {
    const { open, calls } = fakeOpener({ '/bd/a.cbz': [cover] });
    const cache = new ThumbnailCache(dir, open);
    const archive = await open('/bd/a.cbz');

    await cache.storeFromArchive(archive);
    expect(await cache.read('/bd/a.cbz')).not.toBeNull();
    expect(calls.closed).toBe(0);
  });

  it('resolves to null for a book without pages or a file that cannot be opened, and remembers the failure', async () => {
    const { open, calls } = fakeOpener({ '/bd/empty.cbz': [] });
    const cache = new ThumbnailCache(dir, open);

    expect(await cache.ensure('/bd/empty.cbz')).toBeNull();
    expect(await cache.ensure('/bd/missing.cbz')).toBeNull();
    expect(await cache.ensure('/bd/missing.cbz')).toBeNull();
    expect(calls.opened).toBe(1);

    const notAnImage = { data: new Uint8Array([1]), mimeType: 'image/png' };
    const garbage = new ThumbnailCache(dir, fakeOpener({ '/bd/bad.cbz': [notAnImage] }).open);
    expect(await garbage.ensure('/bd/bad.cbz')).toBeNull();
  });

  it('does not remember a failure of the page reader it was given', async () => {
    const { open } = fakeOpener({ '/bd/a.cbz': [cover] });
    const cache = new ThumbnailCache(dir, open);

    expect(
      await cache.ensure('/bd/a.cbz', async () => {
        throw new Error('Archive inconnue');
      }),
    ).toBeNull();
    expect(await cache.ensure('/bd/a.cbz')).not.toBeNull();
  });

  it('keeps the cover beside the comic and reads it back from there', async () => {
    const folder = join(dir, 'library');
    await mkdir(folder);
    const comic = join(folder, 'a.cbz');
    const { open, calls } = fakeOpener({ [comic]: [cover] });
    const cache = new ThumbnailCache(join(dir, 'cache'), open);

    const generated = await cache.ensure(comic);

    expect(coverSidecarPath(comic)).toBe(join(folder, 'a.cover.webp'));
    expect(await readdir(folder)).toEqual(['a.cover.webp']);
    expect(await readdir(dir)).not.toContain('cache');
    // Another machine (or a new cache directory) finds it without opening the comic.
    expect(await new ThumbnailCache(join(dir, 'other-cache'), open).read(comic)).toEqual(generated);
    expect(calls.opened).toBe(1);
  });

  it('falls back to the local cache when the comic folder cannot be written to', async () => {
    const comic = join(dir, 'missing-folder', 'a.cbz');
    const cache = new ThumbnailCache(join(dir, 'cache'), fakeOpener({ [comic]: [cover] }).open);

    const generated = await cache.ensure(comic);

    expect(generated).not.toBeNull();
    expect(await readdir(join(dir, 'cache'))).toEqual([thumbnailKey(comic) + '.webp']);
    expect(await cache.read(comic)).toEqual(generated);
  });

  it('removes a book thumbnail', async () => {
    const cache = new ThumbnailCache(dir, fakeOpener({ '/bd/a.cbz': [cover] }).open);
    await cache.ensure('/bd/a.cbz');

    await cache.remove('/bd/a.cbz');
    expect(await cache.read('/bd/a.cbz')).toBeNull();
    await expect(cache.remove('/bd/a.cbz')).resolves.toBeUndefined();
  });

  it('leaves no thumbnail behind when the book is removed while it is being generated', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let opening!: () => void;
    const started = new Promise<void>((resolve) => {
      opening = resolve;
    });
    const { open } = fakeOpener({ '/bd/a.cbz': [cover] });
    const cache = new ThumbnailCache(dir, async (filePath) => {
      opening();
      await gate;
      return open(filePath);
    });

    const generation = cache.ensure('/bd/a.cbz');
    await started;
    const removal = cache.remove('/bd/a.cbz');
    release();
    await Promise.all([generation, removal]);

    expect(await cache.read('/bd/a.cbz')).toBeNull();
  });

  it('prunes the thumbnails of books no longer in the library, and leftover files', async () => {
    const cache = new ThumbnailCache(dir, fakeOpener({ '/bd/a.cbz': [cover], '/bd/b.cbz': [cover] }).open);
    await cache.ensure('/bd/a.cbz');
    await cache.ensure('/bd/b.cbz');
    await writeFile(join(dir, 'leftover.webp.123.tmp'), 'x');

    await cache.prune(['/bd/a.cbz']);
    expect(await readdir(dir)).toEqual([`${thumbnailKey('/bd/a.cbz')}.webp`]);
  });

  it('does not fail pruning a cache directory that does not exist yet', async () => {
    await expect(new ThumbnailCache(join(dir, 'nope')).prune([])).resolves.toBeUndefined();
  });

  it('rebuilds the cache for a library: prunes, generates the missing ones and retries failures', async () => {
    const pages: Record<string, ComicPage[]> = { '/bd/a.cbz': [cover] };
    const { open, calls } = fakeOpener(pages);
    const cache = new ThumbnailCache(dir, open);
    await cache.ensure('/bd/a.cbz');
    expect(await cache.ensure('/bd/b.cbz')).toBeNull();
    await writeFile(join(dir, `${thumbnailKey('/bd/gone.cbz')}.webp`), 'x');

    pages['/bd/b.cbz'] = [cover];
    await cache.rebuild(['/bd/a.cbz', '/bd/b.cbz']);

    expect((await readdir(dir)).sort()).toEqual(
      [`${thumbnailKey('/bd/a.cbz')}.webp`, `${thumbnailKey('/bd/b.cbz')}.webp`].sort(),
    );
    // a.cbz was already cached: only b.cbz was opened again.
    expect(calls.opened).toBe(2);
  });
});
