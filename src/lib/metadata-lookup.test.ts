import { describe, expect, it } from 'vitest';

import { INITIAL_LOOKUP, lookupReducer, type LookupState, type LookupStep } from './metadata-lookup';
import type { MetadataReview } from './metadata-review';
import type { MetadataCandidate } from '@/shared/metadata';

const candidate = { source: 'comicvine', sourceId: '1', title: 'A', credits: [] } as unknown as MetadataCandidate;
const review: MetadataReview = { fields: [], credits: [], coverUrl: null, coverAccepted: false };
const results: LookupStep = { kind: 'results', candidates: [candidate], errors: [] };

describe('lookupReducer', () => {
  it('starts on the options', () => {
    expect(INITIAL_LOOKUP.step.kind).toBe('options');
  });

  it('shows the answer of the awaited search', () => {
    const searching = lookupReducer(INITIAL_LOOKUP, { type: 'searchStarted', id: 1 });
    expect(searching.step.kind).toBe('searching');
    const done = lookupReducer(searching, { type: 'searchDone', id: 1, step: results });
    expect(done.step).toEqual(results);
    expect(done.searchId).toBeNull();
  });

  it('ignores the answer of a search that was stopped', () => {
    const searching = lookupReducer(INITIAL_LOOKUP, { type: 'searchStarted', id: 1 });
    const stopped = lookupReducer(searching, { type: 'reset' });
    expect(stopped.step.kind).toBe('options');
    expect(lookupReducer(stopped, { type: 'searchDone', id: 1, step: results })).toBe(stopped);
  });

  it('ignores the answer of an earlier search once another one started', () => {
    let state = lookupReducer(INITIAL_LOOKUP, { type: 'searchStarted', id: 1 });
    state = lookupReducer(state, { type: 'searchStarted', id: 2 });
    expect(lookupReducer(state, { type: 'searchDone', id: 1, step: results })).toBe(state);
    expect(lookupReducer(state, { type: 'searchDone', id: 2, step: results }).step).toEqual(results);
  });

  it('goes from the results to a review, edits it and comes back', () => {
    const atResults: LookupState = { step: results, searchId: null };
    const reviewing = lookupReducer(atResults, { type: 'picked', review });
    expect(reviewing.step).toEqual({ kind: 'review', candidates: [candidate], review });
    const edited = { ...review, credits: [] };
    expect(lookupReducer(reviewing, { type: 'reviewChanged', review: edited }).step).toMatchObject({ review: edited });
    expect(lookupReducer(reviewing, { type: 'backToResults' }).step).toEqual(results);
  });

  it('ignores actions that do not fit the step', () => {
    expect(lookupReducer(INITIAL_LOOKUP, { type: 'picked', review })).toBe(INITIAL_LOOKUP);
    expect(lookupReducer(INITIAL_LOOKUP, { type: 'reviewChanged', review })).toBe(INITIAL_LOOKUP);
    expect(lookupReducer(INITIAL_LOOKUP, { type: 'backToResults' })).toBe(INITIAL_LOOKUP);
  });
});
