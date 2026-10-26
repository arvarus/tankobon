// A test helper, not a test: Vitest only runs `*.test.*` files.
/**
 * Plain data for the tests of components and hooks.
 * @module
 */
import type { LibraryEntry } from '@/shared/library';

/** A library entry with no information beyond its file, overridden field by field. */
export function libraryEntry(id: string, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    path: `/books/${id}.cbz`,
    title: id,
    pageCount: 10,
    currentPage: 0,
    addedAt: '2024-01-01T00:00:00.000Z',
    lastOpenedAt: '2024-01-01T00:00:00.000Z',
    fileCount: 10,
    fileSize: 1_000,
    rating: 0,
    tags: [],
    titleLocked: false,
    series: null,
    volume: null,
    releaseDate: null,
    language: null,
    avgPageWidth: null,
    avgPageHeight: null,
    credits: [],
    ...overrides,
  };
}
