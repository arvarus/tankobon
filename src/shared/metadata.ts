/**
 * Metadata lookup types (finding a book's series, volume, authors… in public APIs) shared between
 * the main process and the renderer (via preload).
 * @module
 */
import type { CreditInput } from './library';

/**
 * Where a candidate comes from: the public APIs a lookup queries, or the page of a bookshop or
 * database site whose link the user pasted.
 */
export type MetadataSource = 'comicvine' | 'googlebooks' | 'bedetheque' | 'bdfugue' | 'nautiljon';

/**
 * The sources a search can query (the others are only read from a pasted page link). Bédéthèque has
 * no API: its series search goes through the site's own pages, only when the user ticks it.
 */
export type MetadataApiSource = Extract<MetadataSource, 'comicvine' | 'googlebooks' | 'bedetheque'>;

/** Every {@link MetadataApiSource}, in display order. */
export const METADATA_API_SOURCES: readonly MetadataApiSource[] = ['comicvine', 'googlebooks', 'bedetheque'];

/** Display names of the sources, for the UI. */
export const METADATA_SOURCE_LABELS: Record<MetadataSource, string> = {
  comicvine: 'Comic Vine',
  googlebooks: 'Google Books',
  bedetheque: 'Bédéthèque',
  bdfugue: 'BDfugue',
  nautiljon: 'Nautiljon',
};

/**
 * Whether `text` is the link of a Bédéthèque album page (`https://www.bedetheque.com/BD-….html`),
 * which `metadata.fromPage()` can read instead of running a search.
 */
export function isBedethequeAlbumUrl(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return false;
  }
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    /^(www\.)?bedetheque\.com$/i.test(url.hostname) &&
    /^\/BD-.+-\d+\.html$/i.test(url.pathname)
  );
}

/**
 * The site whose page `text` is a link to (a Bédéthèque album, a BDfugue product or a Nautiljon
 * volume page), or null when it isn't a link `metadata.fromPage()` can read.
 */
export function pageSourceOf(text: string): MetadataSource | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  if (isBedethequeAlbumUrl(text)) {
    return 'bedetheque';
  }
  if (/^(www\.)?bdfugue\.com$/i.test(url.hostname) && url.pathname.length > 1) {
    return 'bdfugue';
  }
  if (/^(www\.)?nautiljon\.com$/i.test(url.hostname) && /^\/mangas\/.+\/volume-\d+/i.test(url.pathname)) {
    return 'nautiljon';
  }
  return null;
}

/** What to look for: free text (usually the series or book title) and an optional volume/issue number. */
export interface MetadataQuery {
  text: string;
  /** Volume or issue number; narrows the Comic Vine search to that issue of the matching series. */
  volume: string | null;
  /** The APIs to query; all the enabled ones when omitted. */
  sources?: MetadataApiSource[];
}

/** One book found by a source, normalized to the library's fields. Any field may be unknown. */
export interface MetadataCandidate {
  source: MetadataSource;
  /** The book's id in its source, unique per source. */
  sourceId: string;
  /** Page of the book on the source's website, if it has one. */
  sourceUrl: string | null;
  /** Small cover image URL, to help the user recognize the right book. */
  coverUrl: string | null;
  /** Book title, without the series name and volume when they could be told apart. */
  title: string | null;
  series: string | null;
  volume: string | null;
  /** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  releaseDate: string | null;
  /** ISO 639-1 code. */
  language: string | null;
  credits: CreditInput[];
}

/**
 * Outcome of `metadata.search()`. A source that fails while another one answers only adds a
 * (French) message to `errors`; `status: 'error'` means no source could be queried at all.
 */
export type MetadataSearchResult =
  | { status: 'ok'; candidates: MetadataCandidate[]; errors: string[] }
  | { status: 'error'; message: string };

/** Outcome of `metadata.fromPage()`: the book read from the page, or a French message. */
export type MetadataPageResult =
  | { status: 'ok'; candidate: MetadataCandidate }
  | { status: 'error'; message: string };
