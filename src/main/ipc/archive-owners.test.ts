import { describe, expect, it } from 'vitest';

import { ArchiveOwners } from './archive-owners';

describe('ArchiveOwners', () => {
  it('hands back the archives a released owner still had open', () => {
    const owners = new ArchiveOwners();
    owners.add(1, 'a');
    owners.add(1, 'b');
    owners.add(2, 'c');

    expect(owners.release(1).sort()).toEqual(['a', 'b']);
    expect(owners.release(1)).toEqual([]);
    expect(owners.release(2)).toEqual(['c']);
  });

  it('forgets an archive that was closed', () => {
    const owners = new ArchiveOwners();
    owners.add(1, 'a');
    owners.add(1, 'b');
    owners.remove('a');
    owners.remove('unknown');

    expect(owners.release(1)).toEqual(['b']);
  });
});
