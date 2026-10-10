import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { LibraryRepository } from '../db/library-repository';
import { migrate } from '../db/schema';
import {
  MAX_NAME_BYTES,
  moveFile,
  organizedFolderName,
  organizedPath,
  organizeEntries,
  planOrganization,
  unorganizedIds,
} from './library-organizer';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

async function tree(files: string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'tankobon-organize-'));
  roots.push(root);
  for (const file of files) {
    const fullPath = path.join(root, file);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file);
  }
  return root;
}

async function exists(filePath: string): Promise<boolean> {
  return stat(filePath).then(
    () => true,
    () => false,
  );
}

function repository(): LibraryRepository {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  return new LibraryRepository(db);
}

const ID = '3f2a9c1e-0000-4000-8000-000000000001';

describe('organizedFolderName', () => {
  it('is the file name without its extension, then the id', () => {
    expect(organizedFolderName('/comics/Astérix T01.cbz', ID)).toBe(`Astérix T01 (${ID})`);
  });

  it('cuts a long name to fit the OS limit, never splitting a character', () => {
    const name = organizedFolderName(`/comics/${'é'.repeat(300)}.cbz`, ID);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(MAX_NAME_BYTES);
    expect(name.endsWith(` (${ID})`)).toBe(true);
    expect(name).not.toContain('�');
  });

  it('drops the trailing spaces and dots left by a cut', () => {
    const name = organizedFolderName(`/comics/${'a'.repeat(214)}. ${'b'.repeat(50)}.cbz`, ID);
    expect(name).toBe(`${'a'.repeat(214)} (${ID})`);
  });
});

describe('moveFile', () => {
  it('moves the file into a new folder', async () => {
    const root = await tree(['in/a.cbz']);
    const to = path.join(root, 'out', 'sub', 'a.cbz');
    await moveFile(path.join(root, 'in/a.cbz'), to);
    expect(await readFile(to, 'utf8')).toBe('in/a.cbz');
    expect(await exists(path.join(root, 'in/a.cbz'))).toBe(false);
  });

  it('never overwrites an existing file', async () => {
    const root = await tree(['a.cbz', 'out/a.cbz']);
    await expect(moveFile(path.join(root, 'a.cbz'), path.join(root, 'out/a.cbz'))).rejects.toThrow();
    expect(await readFile(path.join(root, 'out/a.cbz'), 'utf8')).toBe('out/a.cbz');
    expect(await exists(path.join(root, 'a.cbz'))).toBe(true);
  });

  it('removes the folder it created when the move fails', async () => {
    const root = await tree([]);
    await expect(moveFile(path.join(root, 'missing.cbz'), path.join(root, 'out/missing.cbz'))).rejects.toThrow();
    expect(await exists(path.join(root, 'out'))).toBe(false);
  });
});

describe('organizeEntries', () => {
  it('moves each comic into its own subfolder and points its entry there', async () => {
    const source = await tree(['Série/Tome 1.cbz']);
    const target = await tree([]);
    const repo = repository();
    const from = path.join(source, 'Série/Tome 1.cbz');
    repo.register(from, 'Tome 1', 10, 10, 1);
    const id = repo.idOfPath(from)!;
    repo.updateTags(id, ['Lu']);

    const summary = await organizeEntries(repo, target, [id]);

    const to = organizedPath(target, from, id);
    expect(to).toBe(path.join(target, `Tome 1 (${id})`, 'Tome 1.cbz'));
    expect(summary).toEqual({ moved: [{ id, from, to }], failed: 0 });
    expect(await exists(to)).toBe(true);
    expect(await exists(from)).toBe(false);
    expect(repo.get(id)).toMatchObject({ path: to, tags: ['Lu'] });
    // The source folder is outside the organized folder: left alone, even empty.
    expect(await exists(path.join(source, 'Série'))).toBe(true);
  });

  it('skips a comic already in place and counts a missing file as failed', async () => {
    const target = await tree([]);
    const repo = repository();
    repo.register('/nowhere/gone.cbz', 'gone', 1, 1, 1);
    const gone = repo.idOfPath('/nowhere/gone.cbz')!;

    const first = await organizeEntries(repo, target, [gone, 'unknown-id']);
    expect(first).toEqual({ moved: [], failed: 1 });
    expect(repo.get(gone)?.path).toBe('/nowhere/gone.cbz');
  });

  it('tidies a comic dropped in the organized folder, deleting the subfolder it leaves empty', async () => {
    const target = await tree(['dropped/a.cbz']);
    const repo = repository();
    const from = path.join(target, 'dropped/a.cbz');
    repo.register(from, 'a', 1, 1, 1);
    const id = repo.idOfPath(from)!;

    await organizeEntries(repo, target, [id]);
    const again = await organizeEntries(repo, target, [id]);

    expect(again).toEqual({ moved: [], failed: 0 });
    expect(repo.get(id)?.path).toBe(path.join(target, `a (${id})`, 'a.cbz'));
    expect(await exists(path.join(target, 'dropped'))).toBe(false);
  });
});

describe('planOrganization', () => {
  const added = [
    { id: 'in', path: '/organized/x.cbz' },
    { id: 'out', path: '/comics/y.cbz' },
  ];

  it('does nothing when off or without a folder', () => {
    expect(planOrganization('off', '/organized', added)).toEqual({ now: [], offer: [] });
    expect(planOrganization('always', '', added)).toEqual({ now: [], offer: [] });
  });

  it('moves everything with always', () => {
    expect(planOrganization('always', '/organized', added)).toEqual({ now: ['in', 'out'], offer: [] });
  });

  it('moves what is in the organized folder and offers the rest with ask', () => {
    expect(planOrganization('ask', '/organized', added)).toEqual({ now: ['in'], offer: ['out'] });
  });
});

describe('unorganizedIds', () => {
  it('lists the entries not at their organized path yet', async () => {
    const target = await tree([]);
    const source = await tree(['a.cbz', 'b.cbz']);
    const repo = repository();
    for (const name of ['a.cbz', 'b.cbz']) repo.register(path.join(source, name), name, 1, 1, 1);
    const a = repo.idOfPath(path.join(source, 'a.cbz'))!;
    const b = repo.idOfPath(path.join(source, 'b.cbz'))!;
    expect(unorganizedIds(repo, target).sort()).toEqual([a, b].sort());

    const progress: [number, number][] = [];
    await organizeEntries(repo, target, [a], (processed, total) => progress.push([processed, total]));

    expect(progress).toEqual([[0, 1]]);
    expect(unorganizedIds(repo, target)).toEqual([b]);
  });
});
