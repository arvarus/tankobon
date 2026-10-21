import { describe, expect, it, vi } from 'vitest';

import { bumpCoverRevision, coverRevision, subscribeCoverRevisions } from './cover-revisions';

describe('cover revisions', () => {
  it('counts the replacements of one entry and tells the listeners', () => {
    const listener = vi.fn();
    const stop = subscribeCoverRevisions(listener);
    expect(coverRevision('a')).toBe(0);
    bumpCoverRevision('a');
    bumpCoverRevision('a');
    expect(coverRevision('a')).toBe(2);
    expect(coverRevision('b')).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    bumpCoverRevision('a');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
