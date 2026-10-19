import { describe, expect, it, vi } from 'vitest';

import { LaunchFiles } from './launch-files';
import { PickedFiles } from './picked-files';

describe('LaunchFiles', () => {
  it('hands out the token of an offered comic once, and tells the windows', () => {
    const picked = new PickedFiles();
    const notify = vi.fn();
    const launch = new LaunchFiles(picked, notify);
    expect(launch.offer('/books/a.cbz')).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    const token = launch.take()!;
    expect(picked.get(token)).toEqual({ path: '/books/a.cbz', addToLibrary: false });
    expect(launch.take()).toBeNull();
  });

  it('keeps only the latest offer', () => {
    const picked = new PickedFiles();
    const launch = new LaunchFiles(picked, vi.fn());
    launch.offer('/books/a.cbz');
    launch.offer('/books/b.pdf');
    expect(picked.get(launch.take()!)?.path).toBe('/books/b.pdf');
  });

  it('ignores a file that is not a supported comic', () => {
    const notify = vi.fn();
    const launch = new LaunchFiles(new PickedFiles(), notify);
    expect(launch.offer('/books/notes.txt')).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(launch.take()).toBeNull();
  });
});
