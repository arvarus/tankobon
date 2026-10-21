/**
 * The steps of the metadata lookup dialog as a state machine.
 * @module
 */
import type { MetadataReview } from '@/lib/metadata-review';
import type { MetadataCandidate } from '@/shared/metadata';

/** Where the dialog is: choosing options, waiting for an answer, picking a result or reviewing one. */
export type LookupStep =
  | { kind: 'options' }
  | { kind: 'searching' }
  | { kind: 'results'; candidates: MetadataCandidate[]; errors: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'review'; candidates: MetadataCandidate[]; review: MetadataReview };

/** The dialog's state: the step, and which search (if any) may still change it. */
export interface LookupState {
  step: LookupStep;
  /** The search whose answer is awaited; `null` when none is, so any late answer is ignored. */
  searchId: number | null;
}

/** Everything that can happen in the dialog. */
export type LookupAction =
  /** A search was sent; `id` is unique to it. */
  | { type: 'searchStarted'; id: number }
  /** The answer of search `id`, as the step it leads to; ignored unless that search is the awaited one. */
  | { type: 'searchDone'; id: number; step: LookupStep }
  /** The user stopped the search, or changed the way to look the book up: back to the options. */
  | { type: 'reset' }
  /** A result was picked: its review replaces the results. */
  | { type: 'picked'; review: MetadataReview }
  /** The user edited the review. */
  | { type: 'reviewChanged'; review: MetadataReview }
  /** Back from the review to the results it came from. */
  | { type: 'backToResults' };

/** The dialog before anything is searched. */
export const INITIAL_LOOKUP: LookupState = { step: { kind: 'options' }, searchId: null };

/**
 * The next state of the lookup dialog. A search's answer only counts while that search is the one
 * awaited: stopping, starting another or changing mode drops the awaited id, so a slower, earlier
 * answer can never show stale results. Actions that don't fit the current step change nothing.
 */
export function lookupReducer(state: LookupState, action: LookupAction): LookupState {
  switch (action.type) {
    case 'searchStarted':
      return { step: { kind: 'searching' }, searchId: action.id };
    case 'searchDone':
      return action.id === state.searchId ? { step: action.step, searchId: null } : state;
    case 'reset':
      return INITIAL_LOOKUP;
    case 'picked':
      return state.step.kind === 'results'
        ? { ...state, step: { kind: 'review', candidates: state.step.candidates, review: action.review } }
        : state;
    case 'reviewChanged':
      return state.step.kind === 'review' ? { ...state, step: { ...state.step, review: action.review } } : state;
    case 'backToResults':
      return state.step.kind === 'review'
        ? { ...state, step: { kind: 'results', candidates: state.step.candidates, errors: [] } }
        : state;
  }
}
