import { describe, expect, it } from 'vitest';

import { EMPTY_FILTERS } from './library-filter';
import { rememberedFilters, rememberFilters } from './library-filters-memory';

describe('library filters memory', () => {
  it('gives back the filters the same user left', () => {
    const filters = { ...EMPTY_FILTERS, search: 'tintin', tags: ['Lu'] };
    rememberFilters('u1', filters);
    expect(rememberedFilters('u1')).toEqual(filters);
  });

  it('does not hand them to another user', () => {
    rememberFilters('u1', { ...EMPTY_FILTERS, search: 'tintin' });
    expect(rememberedFilters('u2')).toEqual(EMPTY_FILTERS);
    expect(rememberedFilters(null)).toEqual(EMPTY_FILTERS);
  });
});
