/**
 * The library page's search and filters, kept for the session so they survive leaving the page.
 * @module
 */
import { EMPTY_FILTERS, type LibraryFilters } from './library-filter';

let remembered: { userId: string; filters: LibraryFilters } | null = null;

/** The filters last left by `userId`, or none when nothing was remembered or another user left them. */
export function rememberedFilters(userId: string | null): LibraryFilters {
  return remembered && remembered.userId === userId ? remembered.filters : EMPTY_FILTERS;
}

/** Remembers the filters `userId` has set, replacing any earlier ones. */
export function rememberFilters(userId: string | null, filters: LibraryFilters): void {
  remembered = userId === null ? null : { userId, filters };
}
