import { describe, expect, it } from 'vitest';

import { PendingRequests } from './pending-requests';

describe('PendingRequests', () => {
  it('aborts the lookup of a window on cancel(), and only that window', () => {
    const requests = new PendingRequests();
    const mine = requests.begin(1);
    const other = requests.begin(2);
    requests.cancel(1);
    expect(mine.aborted).toBe(true);
    expect(other.aborted).toBe(false);
  });

  it('aborts the previous lookup of a window when it starts another', () => {
    const requests = new PendingRequests();
    const first = requests.begin(1);
    const second = requests.begin(1);
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it('does nothing when there is nothing to cancel', () => {
    expect(() => new PendingRequests().cancel(1)).not.toThrow();
  });

  it('forgets a finished lookup, so a later cancel() leaves it alone', () => {
    const requests = new PendingRequests();
    const signal = requests.begin(1);
    requests.end(1, signal);
    requests.cancel(1);
    expect(signal.aborted).toBe(false);
  });

  it('keeps the newer lookup when an older one finishes late', () => {
    const requests = new PendingRequests();
    const older = requests.begin(1);
    const newer = requests.begin(1);
    requests.end(1, older);
    requests.cancel(1);
    expect(newer.aborted).toBe(true);
  });
});
