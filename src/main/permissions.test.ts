import { describe, expect, it } from 'vitest';

import { isPermissionAllowed } from './permissions';

describe('isPermissionAllowed', () => {
  it('grants what the reader and the about page use', () => {
    expect(isPermissionAllowed('fullscreen')).toBe(true);
    expect(isPermissionAllowed('clipboard-sanitized-write')).toBe(true);
  });

  it('refuses the rest', () => {
    for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read', 'openExternal', '']) {
      expect(isPermissionAllowed(permission)).toBe(false);
    }
  });
});
