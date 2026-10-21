/**
 * The text shown when hovering a book's title: what names the book, never where its file is.
 * @module
 */

/** The last segment of a file path, whichever separator it uses (`/books/Tintin T20.cbz` → `Tintin T20.cbz`). */
export function fileBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

/**
 * "Series — Title" for a book that has both, the one it has when only one is known (the same name twice
 * is written once, ignoring case), and the file name without its folder when neither is.
 */
export function bookTooltip(book: { series?: string | null; title?: string | null; path: string }): string {
  const series = book.series?.trim() ?? '';
  const title = book.title?.trim() ?? '';
  if (series !== '' && title !== '' && series.toLowerCase() !== title.toLowerCase()) return `${series} — ${title}`;
  return title || series || fileBaseName(book.path);
}
