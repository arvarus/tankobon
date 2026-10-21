/**
 * Reads a book's information from the page of a bookshop or database site (BDfugue, Nautiljon)
 * through the standard metadata those pages embed for search engines and link previews: the
 * schema.org JSON-LD blocks, then the Open Graph `<meta>` tags. Neither site has a public API, and
 * this avoids depending on their markup, which changes more often than those conventions.
 * @module
 */
import { t } from '../../shared/i18n';
import type { CreditInput } from '../../shared/library';
import { type MetadataCandidate, type MetadataSource, METADATA_SOURCE_LABELS, pageSourceOf } from '../../shared/metadata';
import { validReleaseDate } from '../../shared/release-date';
import { splitPersonName, splitSeriesTitle } from '../../shared/title-parsing';
import { getHtml, type HttpOptions } from './http-json';

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** The first `<meta property|name|itemprop="key" content="…">` of the page, in either attribute order. */
function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attr = `(?:property|name|itemprop)=["']${escaped}["']`;
  const forward = new RegExp(`<meta\\b[^>]*?${attr}[^>]*?\\bcontent=(?:"([^"]*)"|'([^']*)')`, 'i').exec(html);
  const backward = new RegExp(`<meta\\b[^>]*?\\bcontent=(?:"([^"]*)"|'([^']*)')[^>]*?${attr}`, 'i').exec(html);
  const match = forward ?? backward;
  const value = match ? (match[1] ?? match[2] ?? '') : '';
  return decodeEntities(value).replace(/\s+/g, ' ').trim() || null;
}

type Json = Record<string, unknown>;

/** Every object found in the page's `application/ld+json` blocks, `@graph` and arrays flattened. */
function jsonLdNodes(html: string): Json[] {
  const nodes: Json[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      nodes.push(value as Json);
      visit((value as Json)['@graph']);
    }
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1]));
    } catch {
      // A damaged block is ignored: the other blocks and the meta tags may still be good.
    }
  }
  return nodes;
}

function typesOf(node: Json): string[] {
  const type = node['@type'];
  return (Array.isArray(type) ? type : [type]).filter((entry): entry is string => typeof entry === 'string');
}

/** A string property, or the `name` of an object property. */
function text(value: unknown): string | null {
  if (typeof value === 'string') return decodeEntities(value).replace(/\s+/g, ' ').trim() || null;
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === 'object') return text((value as Json).name);
  return null;
}

function authorsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((entry) => {
    const name = text(entry);
    // A publisher or a "Collectif" isn't a person.
    return name && !/^collectif$/i.test(name) ? name.split(/\s*(?:;|\s&\s|\set\s)\s*/) : [];
  });
}

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` from an ISO date or timestamp, or from `DD/MM/YYYY`. */
function isoDate(value: string | null): string | null {
  if (!value) return null;
  const iso = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(value);
  if (iso) return validReleaseDate([iso[1], iso[2], iso[3]].filter(Boolean).join('-'));
  const french = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  return french ? validReleaseDate(`${french[3]}-${french[2]}-${french[1]}`) : null;
}

/** An absolute `https` address, or null. */
function absolute(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Builds a candidate from the structured metadata of a page. The title is split into series and
 * volume when it spells the volume out ("Knights of Sidonia - Tome 15", "Knights of Sidonia Vol. 1").
 * The authors only get the generic `author` role: these pages don't tell a writer from an artist.
 * Throws a translated message when the page has no title at all.
 */
export function parseStructuredPage(html: string, url: string, source: MetadataSource): MetadataCandidate {
  const nodes = jsonLdNodes(html);
  const product = nodes.find((node) => typesOf(node).some((type) => /^(Book|ComicIssue|Product|CreativeWork)$/.test(type)));

  const fullTitle = text(product?.name) ?? metaContent(html, 'og:title');
  if (!fullTitle) {
    throw new Error(t('errors:metadata.notBookPage', { source: METADATA_SOURCE_LABELS[source] }));
  }
  // "Title | Nautiljon", "Title - BDfugue": the site's own name isn't part of the title.
  const siteName = METADATA_SOURCE_LABELS[source];
  const cleaned = fullTitle.replace(new RegExp(`\\s*[|\\-–—]\\s*${siteName}\\b.*$`, 'i'), '').trim();
  const split = splitSeriesTitle(cleaned);

  const credits: CreditInput[] = [];
  const seen = new Set<string>();
  for (const name of authorsOf(product?.author ?? product?.creator ?? metaContent(html, 'book:author'))) {
    const person = splitPersonName(name);
    const key = `${person.lastName}|${person.firstName}`.toLowerCase();
    if (person.lastName && !seen.has(key)) {
      seen.add(key);
      credits.push({ ...person, role: 'author' });
    }
  }

  const series = text(product?.isPartOf) ?? split.series;
  return {
    source,
    sourceId: new URL(url).pathname,
    sourceUrl: url,
    coverUrl: absolute(text(product?.image) ?? metaContent(html, 'og:image'), url),
    title: split.series || series ? split.title : cleaned,
    series,
    volume: text(product?.position) ?? text(product?.volumeNumber) ?? split.volume,
    releaseDate: isoDate(text(product?.datePublished) ?? metaContent(html, 'book:release_date')),
    language: (text(product?.inLanguage) ?? metaContent(html, 'og:locale'))?.slice(0, 2).toLowerCase() || null,
    credits,
  };
}

/** Downloads and parses a BDfugue or Nautiljon page. Throws a translated message on failure. */
export async function fetchStructuredPage(url: string, http: HttpOptions): Promise<MetadataCandidate> {
  const source = pageSourceOf(url);
  if (source !== 'bdfugue' && source !== 'nautiljon') {
    throw new Error(t('errors:metadata.notPageUrl'));
  }
  const normalized = new URL(url.trim());
  normalized.protocol = 'https:';
  normalized.hash = '';
  const label = METADATA_SOURCE_LABELS[source];
  return parseStructuredPage(await getHtml(normalized.toString(), http, label), normalized.toString(), source);
}
