/**
 * The bulk edit form ("Edit the selection"): which fields the user chose to change, what the
 * selected books hold now, and the single update applied to all of them (pure, no DOM). The title
 * is left out: giving every book the same title (and locking it) is never what is wanted.
 * @module
 */
import { t } from '@/shared/i18n';
import type { CreditInput, LibraryEntry, MetadataUpdate } from '@/shared/library';
import { type BookForm, type BookFormErrors, newCreditRow, validateForm } from './book-edit';

/** The fields a bulk edit can change. */
export const BULK_FIELDS = ['series', 'volume', 'releaseDate', 'language', 'credits'] as const;

/** One of {@link BULK_FIELDS}. */
export type BulkField = (typeof BULK_FIELDS)[number];

/** The bulk form: the values typed, and the fields the user ticked to apply them. */
export interface BulkForm {
  /** The fields to write on every book; the others are left as they are. */
  enabled: ReadonlySet<BulkField>;
  /** The new values, in the shape of the single-book form (its title is unused). */
  values: BookForm;
}

/** What the selected books hold for a field: one value they all share, or `mixed`. */
export type CurrentValue<T> = { mixed: false; value: T } | { mixed: true };

/** The current value of every bulk field across the selected books. */
export interface BulkCurrent {
  series: CurrentValue<string>;
  volume: CurrentValue<string>;
  releaseDate: CurrentValue<string>;
  language: CurrentValue<string>;
  credits: CurrentValue<CreditInput[]>;
}

function common<T>(values: T[], same: (a: T, b: T) => boolean): CurrentValue<T> {
  const [first, ...rest] = values;
  return rest.every((value) => same(first, value)) ? { mixed: false, value: first } : { mixed: true };
}

function sameCredits(a: readonly CreditInput[], b: readonly CreditInput[]): boolean {
  return (
    a.length === b.length &&
    a.every((c, i) => c.firstName === b[i].firstName && c.lastName === b[i].lastName && c.role === b[i].role)
  );
}

/** What the selected books hold now, field by field (empty string for none); needs at least one book. */
export function bulkCurrent(entries: readonly LibraryEntry[]): BulkCurrent {
  const text = (pick: (entry: LibraryEntry) => string | null) =>
    common(
      entries.map((entry) => pick(entry) ?? ''),
      (a, b) => a === b,
    );
  return {
    series: text((entry) => entry.series),
    volume: text((entry) => entry.volume),
    releaseDate: text((entry) => entry.releaseDate),
    language: text((entry) => entry.language),
    credits: common(
      entries.map((entry): CreditInput[] =>
        entry.credits.map(({ firstName, lastName, role }) => ({
          firstName,
          lastName,
          role,
        })),
      ),
      sameCredits,
    ),
  };
}

/** The empty form: nothing ticked, the values prefilled with what the books share. */
export function emptyBulkForm(current: BulkCurrent): BulkForm {
  const shared = <T>(value: CurrentValue<T>, fallback: T): T => (value.mixed ? fallback : value.value);
  return {
    enabled: new Set(),
    values: {
      title: '',
      series: shared(current.series, ''),
      volume: shared(current.volume, ''),
      releaseDate: shared(current.releaseDate, ''),
      language: shared(current.language, ''),
      credits: shared(current.credits, []).map((credit) => newCreditRow(credit)),
    },
  };
}

/** Errors of the ticked fields only: an unticked field is never written, so it can't block saving. */
export function validateBulkForm(form: BulkForm): BookFormErrors {
  const all = validateForm({ ...form.values, title: 'x' });
  const errors: BookFormErrors = {};
  if (form.enabled.has('releaseDate') && all.releaseDate) {
    errors.releaseDate = t('bookEdit:errors.releaseDate');
  }
  if (form.enabled.has('credits') && all.credits) errors.credits = all.credits;
  return errors;
}

/** The update applied to every book: the ticked fields only; an emptied field clears it. */
export function bulkToUpdate(form: BulkForm): MetadataUpdate {
  const { values, enabled } = form;
  const update: MetadataUpdate = {};
  if (enabled.has('series')) update.series = values.series.trim() || null;
  if (enabled.has('volume')) update.volume = values.volume.trim() || null;
  if (enabled.has('releaseDate')) update.releaseDate = values.releaseDate.trim() || null;
  if (enabled.has('language')) update.language = values.language.trim().toLowerCase() || null;
  if (enabled.has('credits')) {
    update.credits = values.credits
      .filter((row) => row.firstName.trim() !== '' || row.lastName.trim() !== '')
      .map(({ firstName, lastName, role }) => ({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      }));
  }
  return update;
}
