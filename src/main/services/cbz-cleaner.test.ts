import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CbzArchive } from './cbz-archive';
import { listJunkEntries, removeEntries } from './cbz-cleaner';

/** Writes a zip with the given entries (name → content). */
async function writeZip(file: string, entries: Record<string, Buffer>): Promise<void> {
  const zip = new ZipFile();
  for (const [name, data] of Object.entries(entries)) zip.addBuffer(data, name);
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
}

describe('cbz-cleaner', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tankobon-clean-'));
    file = join(dir, 'book.cbz');
    await writeZip(file, {
      '002.jpg': Buffer.alloc(5_000, 2),
      '001.jpg': Buffer.alloc(5_000, 1),
      'ComicInfo.xml': Buffer.from('<ComicInfo/>'),
      'notes/readme.txt': Buffer.from('hello'),
      '__MACOSX/._001.jpg': Buffer.from('fork'),
      'Thumbs.db': Buffer.from('db'),
    });
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('lists the files that are not pages', async () => {
    const junk = await listJunkEntries(file);
    expect(junk.map((entry) => entry.name).sort()).toEqual(
      ['ComicInfo.xml', 'Thumbs.db', '__MACOSX/._001.jpg', 'notes/readme.txt'].sort(),
    );
    expect(junk.find((entry) => entry.name === 'Thumbs.db')?.size).toBe(2);
  });

  it('refuses an archive with no image', async () => {
    const empty = join(dir, 'empty.cbz');
    await writeZip(empty, { 'a.txt': Buffer.from('x') });
    await expect(listJunkEntries(empty)).rejects.toThrow();
  });

  it('rewrites the archive without the named entries and keeps the pages intact', async () => {
    const { fileCount } = await removeEntries(file, ['Thumbs.db', '__MACOSX/._001.jpg', 'notes/readme.txt']);
    expect(fileCount).toBe(3);

    const archive = await CbzArchive.open(file);
    expect(archive.pages).toEqual(['001.jpg', '002.jpg']);
    expect(archive.fileCount).toBe(3);
    expect((await archive.readPage(0)).data[0]).toBe(1);
    expect((await archive.readPage(1)).data.length).toBe(5_000);
    await archive.close();
    expect((await listJunkEntries(file)).map((entry) => entry.name)).toEqual(['ComicInfo.xml']);
    expect(await readdir(dir)).toEqual(['book.cbz']);
  });

  it('leaves the original untouched when an entry is no longer there or is a page', async () => {
    const before = (await stat(file)).size;
    await expect(removeEntries(file, ['gone.txt'])).rejects.toThrow();
    await expect(removeEntries(file, ['001.jpg'])).rejects.toThrow();
    expect((await stat(file)).size).toBe(before);
    expect(await readdir(dir)).toEqual(['book.cbz']);
  });
});
