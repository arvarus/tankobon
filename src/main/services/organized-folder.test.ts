import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { firstFreeName, isDirectory, organizedFolderProblem, pathExists } from './organized-folder';

beforeAll(() => applyLanguage('fr'));

describe('organized-folder', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'tankobon-organized-folder-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('tells a file, a directory and nothing apart', async () => {
    await writeFile(path.join(root, 'a.txt'), '');
    expect(await pathExists(path.join(root, 'a.txt'))).toBe(true);
    expect(await isDirectory(path.join(root, 'a.txt'))).toBe(false);
    expect(await isDirectory(root)).toBe(true);
    expect(await pathExists(path.join(root, 'missing'))).toBe(false);
    expect(await isDirectory(path.join(root, 'missing'))).toBe(false);
  });

  it('finds no problem with a folder that is there and an organization that is on', async () => {
    expect(await organizedFolderProblem('ask', root)).toBeNull();
    expect(await organizedFolderProblem('always', root)).toBeNull();
  });

  it('reports an organization that is off, has no folder, or whose folder is gone', async () => {
    expect(await organizedFolderProblem('off', root)).toMatch(/organis/i);
    expect(await organizedFolderProblem('always', '')).toMatch(/organis/i);
    const gone = path.join(root, 'gone');
    expect(await organizedFolderProblem('always', gone)).toContain(gone);
  });

  it('picks the first free name, with its extension', async () => {
    expect(await firstFreeName(root, 'book', '.cbz')).toBe(path.join(root, 'book.cbz'));
    await writeFile(path.join(root, 'book.cbz'), '');
    await writeFile(path.join(root, 'book (2).cbz'), '');
    expect(await firstFreeName(root, 'book', '.cbz')).toBe(path.join(root, 'book (3).cbz'));
  });

  it('names folders without an extension, and skips what the caller refuses', async () => {
    await mkdir(path.join(root, 'Serie'));
    expect(await firstFreeName(root, 'Serie')).toBe(path.join(root, 'Serie (2)'));
    expect(await firstFreeName(root, 'Serie', '', (candidate) => !candidate.endsWith('(2)'))).toBe(path.join(root, 'Serie (3)'));
  });
});
