import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildNfo, MAX_NFO_BYTES, nfoPathFor, parseNfo, readNfoFor, writeNfoIfMissing } from './nfo';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('parseNfo', () => {
  it('reads the fields and the credits', () => {
    const update = parseNfo(`<?xml version="1.0"?>
      <book>
        <title>Arctic-Nation</title><series>Blacksad</series><volume>2</volume>
        <releasedate>2003-05-12</releasedate><language>FR</language>
        <author role="writer">Juan Díaz Canales</author>
        <author role="artist">Guarnido, Juanjo</author>
        <author>Anonyme</author>
      </book>`);
    expect(update).toEqual({
      title: 'Arctic-Nation',
      series: 'Blacksad',
      volume: '2',
      releaseDate: '2003-05-12',
      language: 'fr',
      credits: [
        { firstName: 'Juan Díaz', lastName: 'Canales', role: 'writer' },
        { firstName: 'Juanjo', lastName: 'Guarnido', role: 'artist' },
        { firstName: '', lastName: 'Anonyme', role: 'author' },
      ],
    });
  });

  it('falls back on <year>, role elements and an unknown role', () => {
    const update = parseNfo('<year>2003</year><writer>Hergé</writer><author role="boss">X Y</author>');
    expect(update?.releaseDate).toBe('2003');
    expect(update?.credits).toEqual([
      { firstName: 'X', lastName: 'Y', role: 'author' },
      { firstName: '', lastName: 'Hergé', role: 'writer' },
    ]);
  });

  it('drops invalid values and returns null when nothing is usable', () => {
    expect(parseNfo('<releasedate>2003-02-31</releasedate><language>français</language>')).toBeNull();
    expect(parseNfo('not xml at all')).toBeNull();
  });

  it('decodes the predefined entities and strips markup and control characters', () => {
    const update = parseNfo('<title><![CDATA[A <b>&amp;</b>\u0000B]]></title><series>Tom &amp; Jerry &#x41;&bogus;</series>');
    expect(update?.title).toBe('A & B');
    expect(update?.series).toBe('Tom & Jerry A&bogus;');
  });

  it('bounds the length of a value and the number of credits', () => {
    const authors = Array.from({ length: 80 }, (_, i) => `<author>P${i} Name</author>`).join('');
    const update = parseNfo(`<title>${'x'.repeat(1000)}</title>${authors}`);
    expect(update?.title).toHaveLength(300);
    expect(update?.credits).toHaveLength(50);
  });
});

describe('readNfoFor', () => {
  async function dir(): Promise<string> {
    const d = await mkdtemp(path.join(tmpdir(), 'tankobon-nfo-'));
    dirs.push(d);
    return d;
  }

  it('reads the sidecar of the same name', async () => {
    const d = await dir();
    await writeFile(nfoPathFor(path.join(d, 'Tome 1.cbz')), '<title>Un</title>');
    expect(await readNfoFor(path.join(d, 'Tome 1.cbz'))).toEqual({ title: 'Un' });
  });

  it('ignores a missing or oversized file', async () => {
    const d = await dir();
    expect(await readNfoFor(path.join(d, 'a.cbz'))).toBeNull();
    await writeFile(path.join(d, 'b.nfo'), `<title>${'x'.repeat(MAX_NFO_BYTES)}</title>`);
    expect(await readNfoFor(path.join(d, 'b.cbz'))).toBeNull();
  });
});

describe('buildNfo', () => {
  const entry = {
    title: 'Tom & <Jerry>',
    series: 'Cartoons',
    volume: '3',
    releaseDate: '2003-05',
    language: 'fr',
    credits: [
      { personId: '1', firstName: 'Jean', lastName: 'Van Hamme', role: 'writer' as const },
      { personId: '2', firstName: '', lastName: 'Moebius', role: 'artist' as const },
    ],
  };

  it('is read back by parseNfo', () => {
    expect(parseNfo(buildNfo(entry))).toEqual({
      title: 'Tom & <Jerry>',
      series: 'Cartoons',
      volume: '3',
      releaseDate: '2003-05',
      language: 'fr',
      credits: [
        { firstName: 'Jean', lastName: 'Van Hamme', role: 'writer' },
        { firstName: '', lastName: 'Moebius', role: 'artist' },
      ],
    });
  });

  it('leaves out the unknown fields', () => {
    const text = buildNfo({ title: 'Seul', series: null, volume: null, releaseDate: null, language: null, credits: [] });
    expect(parseNfo(text)).toEqual({ title: 'Seul' });
  });
});

describe('writeNfoIfMissing', () => {
  const base = { title: 'Un', series: null, volume: null, releaseDate: null, language: null, credits: [] };

  it('creates the sidecar, then never overwrites it', async () => {
    const d = await mkdtemp(path.join(tmpdir(), 'tankobon-nfo-'));
    dirs.push(d);
    const comic = path.join(d, 'Tome 1.cbz');
    expect(await writeNfoIfMissing({ ...base, path: comic })).toBe(true);
    expect(await readFile(nfoPathFor(comic), 'utf8')).toContain('<title>Un</title>');
    await writeFile(nfoPathFor(comic), '<title>Mien</title>');
    expect(await writeNfoIfMissing({ ...base, path: comic })).toBe(false);
    expect(await readFile(nfoPathFor(comic), 'utf8')).toBe('<title>Mien</title>');
  });

  it('returns false when the folder is missing', async () => {
    expect(await writeNfoIfMissing({ ...base, path: path.join(tmpdir(), 'tankobon-nfo-none', 'a.cbz') })).toBe(false);
  });
});
