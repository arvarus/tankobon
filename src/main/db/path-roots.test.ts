import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { PathRoots, memoryRootsStore } from './path-roots';

const lib = path.resolve('/data/lib');

describe('PathRoots', () => {
  it('stores a file under a folder relative to it, with forward slashes', () => {
    const roots = new PathRoots();
    roots.set('r1', lib);
    expect(roots.encode(path.join(lib, 'Series', 'one.cbz'))).toBe('root:r1/Series/one.cbz');
  });

  it('keeps the absolute path of a file outside every folder', () => {
    const roots = new PathRoots();
    roots.set('r1', lib);
    const outside = path.resolve('/elsewhere/one.cbz');
    expect(roots.encode(outside)).toBe(outside);
    expect(roots.encode(path.resolve('/data/library/one.cbz'))).toBe(path.resolve('/data/library/one.cbz'));
  });

  it('stores a file whose name or first folder starts with two dots, and brings it back', () => {
    const roots = new PathRoots();
    roots.set('r1', lib);
    const file = path.join(lib, '...Et alors.cbz');
    const nested = path.join(lib, '..hidden', 'one.cbz');
    expect(roots.encode(file)).toBe('root:r1/...Et alors.cbz');
    expect(roots.encode(nested)).toBe('root:r1/..hidden/one.cbz');
    expect(roots.decode(roots.encode(nested))).toBe(nested);
  });

  it('does not decode a stored path out of its folder', () => {
    const roots = new PathRoots();
    roots.set('r1', lib);
    expect(roots.decode('root:r1/../../etc/x.cbz')).toBe('root:r1/../../etc/x.cbz');
    expect(roots.decode('root:r1/a/../b.cbz')).toBe(path.join(lib, 'b.cbz'));
  });

  it('prefers the deepest folder', () => {
    const roots = new PathRoots();
    roots.set('outer', lib);
    roots.set('inner', path.join(lib, 'manga'));
    expect(roots.encode(path.join(lib, 'manga', 'a.cbz'))).toBe('root:inner/a.cbz');
    expect(roots.encode(path.join(lib, 'b.cbz'))).toBe('root:outer/b.cbz');
  });

  it('decodes on another machine where the folder is somewhere else', () => {
    const here = new PathRoots();
    here.set('r1', lib);
    const stored = here.encode(path.join(lib, 'S', 'a.cbz'));
    const there = new PathRoots();
    there.set('r1', path.resolve('/mnt/share'));
    expect(there.decode(stored)).toBe(path.join(path.resolve('/mnt/share'), 'S', 'a.cbz'));
  });

  it('leaves a folder without a path here, and absolute paths, as they are', () => {
    const roots = new PathRoots();
    expect(roots.decode('root:gone/a.cbz')).toBe('root:gone/a.cbz');
    expect(roots.encode('root:gone/a.cbz')).toBe('root:gone/a.cbz');
    expect(roots.decode('/abs/a.cbz')).toBe('/abs/a.cbz');
  });

  it('reloads what the store holds', () => {
    const store = memoryRootsStore();
    new PathRoots(store).set('r1', lib);
    expect(new PathRoots(store).get('r1')).toBe(lib);
  });
});
