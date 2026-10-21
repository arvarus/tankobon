/**
 * Release dates: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, whatever precision a source has, and a date that exists.
 * @module
 */

const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Whether `value` is a `YYYY`, `YYYY-MM` or `YYYY-MM-DD` date that exists. */
export function isValidReleaseDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  if (month === undefined) return true;
  const m = Number(month);
  if (m < 1 || m > 12) return false;
  if (day === undefined) return true;
  const d = Number(day);
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
  return d >= 1 && d <= daysInMonth;
}

/**
 * The release date a source gave, as `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (a time after the date, `T…` or
 * ` …`, is dropped), or `null` when it is missing or not a date that exists (`2024-99-99`).
 */
export function validReleaseDate(value: string | null | undefined): string | null {
  const date = /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)(?:[T ].*)?$/.exec(value?.trim() ?? '')?.[1];
  return date !== undefined && isValidReleaseDate(date) ? date : null;
}
