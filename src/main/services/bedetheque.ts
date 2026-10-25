/**
 * Reads a book's information from a Bédéthèque album page, whose link the user pasted, or finds the
 * album of a series by name and volume. Bédéthèque (the BDGest' database) has no public API: the
 * pages' HTML is parsed, and the series is found through the JSON the BDGest search box uses.
 * @module
 */
import { t } from '../../shared/i18n';
import type { CreditInput, CreditRole } from '../../shared/library';
import { isBedethequeAlbumUrl, type MetadataCandidate, type MetadataQuery } from '../../shared/metadata';
import { splitPersonName } from '../../shared/title-parsing';
import { getHtml, getJson, type HttpOptions } from './http-json';

const SOURCE = 'Bédéthèque';

/** Bédéthèque's credit labels; the others ("Traduction", "Préface", "Autres"…) are dropped. */
const ROLES: Record<string, CreditRole> = {
  'scénario': 'writer',
  dessin: 'artist',
  couleurs: 'colorist',
  encrage: 'inker',
  lettrage: 'letterer',
  couverture: 'cover',
};

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the HTML entities found in Bédéthèque's text (named basics and numeric ones). */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** The text of an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** The `content` of the first `<meta itemprop="…">` in `html`. */
function metaItemprop(html: string, prop: string): string | null {
  const match = new RegExp(`<meta\\s+itemprop="${prop}"\\s+content="([^"]*)"`, 'i').exec(html);
  return match ? decodeEntities(match[1]).trim() || null : null;
}

/**
 * The release date: the legal deposit ("Dépôt légal") is `MM/YYYY`, with the exact day in
 * parentheses when Bédéthèque knows it. Its `datePublished` meta pads an unknown day with `01`, so
 * it is only used when that day is spelled out.
 */
function releaseDate(album: string): string | null {
  const deposit = /<li title="Dépôt légal">([\s\S]*?)<\/li>/i.exec(album)?.[1];
  if (!deposit) {
    return null;
  }
  const published = metaItemprop(deposit, 'datePublished');
  if (published && /^\d{4}-\d{2}-\d{2}$/.test(published) && /\(\s*\d{1,2}(er)? \S+ \d{4}\s*\)/.test(textOf(deposit))) {
    return published;
  }
  const shown = textOf(/<b>([\s\S]*?)<\/b>/i.exec(deposit)?.[1] ?? '');
  const monthYear = /^(\d{2})\/(\d{4})$/.exec(shown);
  if (monthYear) {
    return `${monthYear[2]}-${monthYear[1]}`;
  }
  return /^\d{4}$/.test(shown) ? shown : null;
}

/**
 * The album's credits, in the page's order. Placeholders such as `<N&B>` or `<Collectif>` aren't
 * people and are dropped; a person credited twice for the same role is kept once.
 */
function credits(album: string): CreditInput[] {
  const list = /<div class="[^"]*\bliste-auteurs\b[^"]*">([\s\S]*?)<\/div>/i.exec(album)?.[1] ?? '';
  const result: CreditInput[] = [];
  const seen = new Set<string>();
  // Attribute values are skipped as a whole: a placeholder's `title` holds a raw "<N&B>".
  for (const match of list.matchAll(/<a\b(?:"[^"]*"|[^">])*>([\s\S]*?)<\/a>\s*<small>([\s\S]*?)<\/small>/gi)) {
    const name = textOf(match[1]);
    const role = ROLES[textOf(match[2]).replace(/[()]/g, '').trim().toLowerCase()];
    if (!role || !name || name.startsWith('<')) {
      continue;
    }
    const credit = { ...splitPersonName(name), role };
    const key = `${credit.lastName}|${credit.firstName}|${role}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(credit);
    }
  }
  return result;
}

/**
 * Parses a Bédéthèque album page. Only its main album block (`<section class="bdt-ah">`) is read,
 * not the series' other albums or editions further down the page. Throws a translated message when
 * the page has no album block.
 */
export function parseBedethequeAlbum(html: string, url: string): MetadataCandidate {
  const album = /<section class="bdt-ah">([\s\S]*?)<\/section>/i.exec(html)?.[1];
  if (!album) {
    throw new Error(t('errors:metadata.notAlbumPage', { source: SOURCE }));
  }

  const series = textOf(/<h1>([\s\S]*?)<\/h1>/i.exec(album)?.[1] ?? '') || null;
  // "6<span class="bdt-numa"></span>. Sibylline et les cravates noires": the number, an optional
  // letter ("12a"), then the title. A one-shot has no number.
  const subtitle = textOf(/<h2 class="bdt-ah-sub">([\s\S]*?)<\/h2>/i.exec(album)?.[1] ?? '');
  const numbered = /^([^\s.]+)\s*\.\s*(.*)$/.exec(subtitle);
  const volume = numbered ? numbered[1] : null;
  const title = (numbered ? numbered[2] : subtitle) || metaItemprop(album, 'alternativeheadline');

  return {
    source: 'bedetheque',
    sourceId: /-(\d+)\.html$/i.exec(new URL(url).pathname)?.[1] ?? url,
    sourceUrl: url,
    coverUrl: /<img\s+itemprop="image"\s+src="([^"]+)"/i.exec(album)?.[1] ?? null,
    title: title || null,
    series,
    volume,
    releaseDate: releaseDate(album),
    language: metaItemprop(album, 'inLanguage'),
    credits: credits(album),
  };
}

/** Downloads and parses a Bédéthèque album page. Throws a translated message on failure. */
export async function fetchBedethequeAlbum(url: string, http: HttpOptions): Promise<MetadataCandidate> {
  if (!isBedethequeAlbumUrl(url)) {
    throw new Error(t('errors:metadata.notAlbumUrl', { source: SOURCE }));
  }
  const normalized = new URL(url.trim());
  normalized.protocol = 'https:';
  normalized.hash = '';
  return parseBedethequeAlbum(await getHtml(normalized.toString(), http, SOURCE), normalized.toString());
}

/** The site's search box: the series (ids `S123`) and authors (`A123`) whose name contains the term. */
const SERIES_SEARCH_URL = 'https://www.bdgest.com/ajax/tout';
/** Shorter terms are refused by the search box itself. */
const MIN_SEARCH_LENGTH = 3;
/** The page that redirects to a series' page from its id, as the site's own search box does. */
const SERIES_PAGE_URL = 'https://www.bedetheque.com/serie/index/s/';
/** At most this many albums of a series are offered when none could be told to be the right one. */
const MAX_SERIES_CANDIDATES = 30;
/** How long a series' album list is remembered, so picking several volumes of it reads its page once. */
const SERIES_TTL_MS = 10 * 60 * 1000;
const SERIES_CACHE_SIZE = 20;

/** A series found by the search box. */
export interface BedethequeSeries {
  /** The numeric part of the site's `S<id>`. */
  id: string;
  /** The name shown, with the language in parentheses for a translation: `Blacksad (en allemand)`. */
  label: string;
}

/** What a line of a series' album list is: a numbered album, a special issue or an omnibus. */
export type SeriesAlbumKind = 'album' | 'hs' | 'int';

/** One line of a series' album list. */
export interface SeriesAlbum {
  url: string;
  /** The number as the site writes it: `1`, `HS`, `HS2`, `INT01`; empty for a one-shot. */
  number: string;
  title: string;
  /** `YYYY-MM`, or `YYYY`; null when the list shows none. */
  releaseDate: string | null;
  kind: SeriesAlbumKind;
}

/** Lower case, no accents, letters and digits only: how series names are compared. */
function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The series in the search box's answer (an array of `{ id, label, category }`); anything else is ignored. */
export function parseSeriesSearch(body: unknown): BedethequeSeries[] {
  if (!Array.isArray(body)) {
    return [];
  }
  const series: BedethequeSeries[] = [];
  for (const item of body) {
    const { id, label } = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const match = typeof id === 'string' ? /^S(\d+)$/.exec(id) : null;
    if (match && typeof label === 'string' && label.trim()) {
      series.push({ id: match[1], label: label.trim() });
    }
  }
  return series;
}

/**
 * The series that is the one asked for: the name equal to the text (accents and case ignored), else
 * the shortest name starting with it, else the shortest containing it. A translation of a series
 * (`Blacksad (en allemand)`) only wins when nothing else matches; null when no name contains the text.
 */
export function pickSeries(candidates: BedethequeSeries[], text: string): BedethequeSeries | null {
  const wanted = normalizeName(text);
  if (!wanted) {
    return null;
  }
  const isTranslation = (series: BedethequeSeries) => /\(\s*en\s[^)]*\)\s*$/i.test(series.label);
  const rank = (series: BedethequeSeries): number => {
    const name = normalizeName(series.label);
    const bare = normalizeName(series.label.replace(/\([^)]*\)\s*$/, ''));
    if (name === wanted) return 0;
    if (!isTranslation(series) && bare === wanted) return 1;
    if (!isTranslation(series) && name.startsWith(wanted)) return 2;
    if (!isTranslation(series) && name.includes(wanted)) return 3;
    if (bare === wanted) return 4;
    return name.includes(wanted) ? 5 : Infinity;
  };
  const ranked = candidates
    .map((series, index) => ({ series, index, rank: rank(series) }))
    .filter((entry) => entry.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank || a.series.label.length - b.series.label.length || a.index - b.index);
  return ranked[0]?.series ?? null;
}

/** `MM/YYYY` (or `YYYY`) as the list shows the legal deposit, to `YYYY-MM` (or `YYYY`). */
function listDate(text: string): string | null {
  const monthYear = /^(\d{2})\/(\d{4})$/.exec(text);
  if (monthYear) {
    return `${monthYear[2]}-${monthYear[1]}`;
  }
  return /^\d{4}$/.test(text) ? text : null;
}

/**
 * The albums of a series page, from the box that lists all of them (14 for Blacksad, specials and
 * omnibuses included, with no paging). The preview of the first covers and the paged detail further
 * down the page are not read. The `<li>` class says what a line is: none for an album, `is-hs` for a
 * special issue, `is-int` for an omnibus; the group headings are skipped.
 */
export function parseSeriesAlbums(html: string): SeriesAlbum[] {
  const list = /<ul class="bdt-box-albums-liste">([\s\S]*?)<\/ul>/i.exec(html)?.[1];
  if (!list) {
    return [];
  }
  const albums: SeriesAlbum[] = [];
  for (const item of list.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const classes = /class="([^"]*)"/i.exec(item[1])?.[1].split(/\s+/) ?? [];
    const url = /<a\s+href="([^"]+)"/i.exec(item[2])?.[1];
    if (classes.includes('bdt-box-albums-grp') || !url || !isBedethequeAlbumUrl(url)) {
      continue;
    }
    albums.push({
      url,
      number: decodeEntities(/<span class="bdt-box-albums-num" title="([^"]*)"/i.exec(item[2])?.[1] ?? '').trim(),
      title: textOf(/<span class="bdt-box-albums-titre">([\s\S]*?)<\/span>/i.exec(item[2])?.[1] ?? ''),
      releaseDate: listDate(textOf(/<span class="bdt-box-albums-dl">([\s\S]*?)<\/span>/i.exec(item[2])?.[1] ?? '')),
      kind: classes.includes('is-hs') ? 'hs' : classes.includes('is-int') ? 'int' : 'album',
    });
  }
  return albums;
}

/** A volume number as compared: upper case, leading zeros of a plain number dropped (`01` is `1`). */
function normalizeNumber(text: string): string {
  return text.trim().toUpperCase().replace(/^0+(?=\d)/, '');
}

/**
 * The album of `volume` in a series: the line whose number is that volume (`3`, `HS1`, `INT01`),
 * numbered albums first. Without a volume, the series' only numbered album (a one-shot), or its
 * only album when it has no other kind. Null when none can be told to be the right one.
 */
export function pickAlbum(albums: SeriesAlbum[], volume: string | null): SeriesAlbum | null {
  const wanted = normalizeNumber(volume ?? '');
  if (wanted) {
    const matches = albums.filter((album) => normalizeNumber(album.number) === wanted);
    return matches.find((album) => album.kind === 'album') ?? matches[0] ?? null;
  }
  const numbered = albums.filter((album) => album.kind === 'album');
  if (numbered.length === 1) {
    return numbered[0];
  }
  return numbered.length === 0 && albums.length === 1 ? albums[0] : null;
}

/** An album of the list as a candidate: what the list shows, the credits left for the album page. */
function listCandidate(album: SeriesAlbum, series: string): MetadataCandidate {
  return {
    source: 'bedetheque',
    sourceId: /-(\d+)\.html$/i.exec(new URL(album.url).pathname)?.[1] ?? album.url,
    sourceUrl: album.url,
    coverUrl: null,
    title: album.title || null,
    series,
    volume: album.number || null,
    releaseDate: album.releaseDate,
    language: null,
    credits: [],
  };
}

/** The albums of series pages already read, by series id. Rejections aren't kept. */
const seriesCache = new Map<string, { at: number; albums: Promise<SeriesAlbum[]> }>();

/** The album list of a series page, read once per {@link SERIES_TTL_MS}. */
function albumsOfSeries(id: string, http: HttpOptions): Promise<SeriesAlbum[]> {
  const known = seriesCache.get(id);
  if (known && Date.now() - known.at < SERIES_TTL_MS) {
    return known.albums;
  }
  const albums = getHtml(`${SERIES_PAGE_URL}${id}`, http, SOURCE).then(parseSeriesAlbums);
  seriesCache.delete(id);
  seriesCache.set(id, { at: Date.now(), albums });
  albums.catch(() => seriesCache.delete(id));
  // A Map iterates in insertion order: the first key is the oldest.
  if (seriesCache.size > SERIES_CACHE_SIZE) {
    seriesCache.delete(seriesCache.keys().next().value as string);
  }
  return albums;
}

/** Forgets the series pages already read (the tests start from nothing). */
export function clearSeriesCache(): void {
  seriesCache.clear();
}

/**
 * Finds a book by series name and volume, in three sequential requests at most: the search box's
 * JSON for the series, the series page for its album list, then the album's page for its credits.
 * Returns that one album when the volume is found (or the series has a single album); otherwise the
 * series' albums as candidates, with no credits yet (the album page is read when one is picked).
 * Nothing is returned when no series matches, or the text is too short for the site's search box.
 */
export async function searchBedetheque(query: MetadataQuery, http: HttpOptions): Promise<MetadataCandidate[]> {
  const text = query.text.trim();
  if (text.length < MIN_SEARCH_LENGTH) {
    return [];
  }
  const found = parseSeriesSearch(await getJson(`${SERIES_SEARCH_URL}?term=${encodeURIComponent(text)}`, http, SOURCE));
  const series = pickSeries(found, text);
  if (!series) {
    return [];
  }
  const albums = await albumsOfSeries(series.id, http);
  const album = pickAlbum(albums, query.volume);
  if (album) {
    return [await fetchBedethequeAlbum(album.url, http)];
  }
  return albums.slice(0, MAX_SERIES_CANDIDATES).map((entry) => listCandidate(entry, series.label));
}
