import { describe, expect, it } from 'vitest';

import { isDarkTheme } from './theme';

describe('isDarkTheme', () => {
  it('follows the system for "system"', () => {
    expect(isDarkTheme('system', true)).toBe(true);
    expect(isDarkTheme('system', false)).toBe(false);
  });

  it('ignores the system when forced', () => {
    expect(isDarkTheme('dark', false)).toBe(true);
    expect(isDarkTheme('light', true)).toBe(false);
  });
});
