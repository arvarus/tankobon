import { describe, expect, it } from 'vitest';

import { createRecoveryGuard } from './recovery-guard';

describe('createRecoveryGuard', () => {
  it('allows one reopening, then refuses until a page was read', () => {
    const guard = createRecoveryGuard();
    expect(guard.tryRecover()).toBe(true);
    expect(guard.tryRecover()).toBe(false);
    expect(guard.tryRecover()).toBe(false);

    guard.succeeded();
    expect(guard.tryRecover()).toBe(true);
  });

  it('treats a success with nothing to recover as a no-op', () => {
    const guard = createRecoveryGuard();
    guard.succeeded();
    expect(guard.tryRecover()).toBe(true);
    expect(guard.tryRecover()).toBe(false);
  });
});
