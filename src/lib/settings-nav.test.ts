import { describe, expect, it } from 'vitest';

import { SETTINGS_GROUPS, isOrganizationOn, visibleSections } from './settings-nav';

const ids = (organization: 'off' | 'ask' | 'always') =>
  SETTINGS_GROUPS.flatMap((group) => visibleSections(group, { libraryOrganization: organization })).map((s) => s.id);

describe('settings navigation', () => {
  it('hides the organization section while the organized library is off', () => {
    expect(isOrganizationOn({ libraryOrganization: 'off' })).toBe(false);
    expect(ids('off')).not.toContain('organization');
    expect(ids('off')).toContain('library');
  });

  it('shows it once the organized library is on', () => {
    expect(ids('ask')).toContain('organization');
    expect(ids('always')).toContain('organization');
  });
});
