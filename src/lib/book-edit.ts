/**
 * The manual edit form of a book ("Edit details"): its initial values, their validation and
 * the update they produce (pure, no DOM). Unlike a lookup, nothing comes from the network: every
 * field is typed by the user.
 * @module
 */
import { t } from '@/shared/i18n';
import type { CreditInput, LibraryEntry, MetadataUpdate } from '@/shared/library';
import { isValidReleaseDate } from '@/shared/release-date';

/** One credit row of the form. */
export interface CreditRow extends CreditInput {
  /** Stable key for React lists, so that removing a row doesn't shift the inputs' state. */
  key: string;
}

/** Everything the edit form holds, as typed (untrimmed, empty string for nothing). */
export interface BookForm {
  title: string;
  series: string;
  volume: string;
  releaseDate: string;
  /** An ISO 639-1 code, or empty for none. */
  language: string;
  credits: CreditRow[];
}

/** The form fields that can be invalid. */
export type BookFormField = 'title' | 'releaseDate';

/** Error messages (in the current language), by field, for the fields that are invalid; empty when the form can be saved. */
export type BookFormErrors = Partial<Record<BookFormField, string>> & {
  /** Errors of the credit rows, by row key. */
  credits?: Record<string, string>;
};

/** The languages offered in the form, as ISO 639-1 codes, most common first. */
export const BOOK_LANGUAGES: readonly string[] = ['fr', 'en', 'ja', 'es', 'it', 'de', 'nl', 'pt', 'ko', 'zh'];

let rowCounter = 0;

/** A new credit row, empty unless given values. */
export function newCreditRow(credit: CreditInput = { firstName: '', lastName: '', role: 'writer' }): CreditRow {
  rowCounter += 1;
  return {
    firstName: credit.firstName,
    lastName: credit.lastName,
    role: credit.role,
    key: `credit-${rowCounter}`,
  };
}

/** The form prefilled with the entry's current values. */
export function entryToForm(entry: LibraryEntry): BookForm {
  return {
    title: entry.title,
    series: entry.series ?? '',
    volume: entry.volume ?? '',
    releaseDate: entry.releaseDate ?? '',
    language: entry.language ?? '',
    credits: entry.credits.map((credit) => newCreditRow(credit)),
  };
}

/**
 * Whether two credit lists are the same, exactly: unlike a lookup's review, fixing the case or
 * accents of a name by hand is a change.
 */
function sameCredits(a: readonly CreditInput[], b: readonly CreditInput[]): boolean {
  return (
    a.length === b.length &&
    a.every((c, i) => c.firstName === b[i].firstName && c.lastName === b[i].lastName && c.role === b[i].role)
  );
}

/** Whether a credit row was left completely empty (it is then ignored rather than refused). */
function isBlankRow(row: CreditRow): boolean {
  return row.firstName.trim() === '' && row.lastName.trim() === '';
}

/**
 * Checks the form: the title can't be empty, the release date must be a real `YYYY`, `YYYY-MM` or
 * `YYYY-MM-DD` date, and a credit row with a first name needs a last name (a single-word pen name
 * goes in the last name). Blank credit rows are fine. The language is picked from a list, so it
 * isn't checked.
 */
export function validateForm(form: BookForm): BookFormErrors {
  const errors: BookFormErrors = {};
  if (form.title.trim() === '') {
    errors.title = t('bookEdit:errors.emptyTitle');
  }
  const date = form.releaseDate.trim();
  if (date !== '' && !isValidReleaseDate(date)) {
    errors.releaseDate = t('bookEdit:errors.releaseDate');
  }
  const creditErrors: Record<string, string> = {};
  for (const row of form.credits) {
    if (!isBlankRow(row) && row.lastName.trim() === '') {
      creditErrors[row.key] = t('bookEdit:errors.lastName');
    }
  }
  if (Object.keys(creditErrors).length > 0) {
    errors.credits = creditErrors;
  }
  return errors;
}

/** Whether `validateForm()` found nothing wrong. */
export function isValidForm(errors: BookFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * The update the form produces: only the fields that differ from the entry. An emptied field is
 * cleared; a changed title is locked (see `LibraryEntry.titleLocked`); the language is lowercased;
 * the credits, blank rows dropped, replace the entry's whole list when they changed. Meant for a
 * form `validateForm()` accepted.
 */
export function formToUpdate(entry: LibraryEntry, form: BookForm): MetadataUpdate {
  const update: MetadataUpdate = {};
  const title = form.title.trim();
  if (title !== '' && title !== entry.title) update.title = title;

  const fields = {
    series: form.series.trim() || null,
    volume: form.volume.trim() || null,
    releaseDate: form.releaseDate.trim() || null,
    language: form.language.trim().toLowerCase() || null,
  };
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    if (fields[field] !== entry[field]) update[field] = fields[field];
  }

  const credits = form.credits
    .filter((row) => !isBlankRow(row))
    .map(({ firstName, lastName, role }) => ({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
    }));
  if (!sameCredits(credits, entry.credits)) update.credits = credits;
  return update;
}
