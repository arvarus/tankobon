/**
 * Reads the `.nfo` file that can sit next to a comic (same name, `.nfo` extension) and turns it
 * into the metadata of the book. The file is user-supplied text, so nothing in it is trusted:
 * it is read through a size cap, tags are matched flatly (no XML parser, hence no entities beyond
 * the five predefined ones, no DTD, no external reference), every value is cleaned and bounded, and
 * a value that doesn't fit its field is dropped.
 * @module
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { CREDIT_ROLES, type CreditInput, type CreditRole, type MetadataUpdate } from '../../shared/library';
import { splitPersonName } from '../../shared/title-parsing';

/** Largest `.nfo` that is read (bytes); a bigger file is ignored. */
export const MAX_NFO_BYTES = 256 * 1024;
/** Longest accepted text value (characters). */
const MAX_VALUE_LENGTH = 300;
/** Most credits taken from one file. */
const MAX_CREDITS = 50;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(?:#(\d{1,6})|#x([0-9a-f]{1,5})|(amp|lt|gt|quot|apos));/gi, (_all, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()];
    const code = dec ? Number(dec) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

/** The text of a value: CDATA unwrapped, entities decoded, control characters and extra spaces removed, cut to length. */
function cleanValue(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // eslint-disable-next-line no-control-regex
  const text = decode(unwrapped.replace(/<[^>]*>/g, ' ')).replace(/[\u0000-\u001f\u007f]/g, ' ');
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_LENGTH);
}

interface Element {
  attributes: string;
  text: string;
}

/** Every `<name …>text</name>` of the file, in order (names compared ignoring case). */
function elements(xml: string, name: string): Element[] {
  const pattern = new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, 'gi');
  return [...xml.matchAll(pattern)].map((match) => ({ attributes: match[1] ?? '', text: cleanValue(match[2]) }));
}

function firstText(xml: string, ...names: string[]): string {
  for (const name of names) {
    const found = elements(xml, name).find((element) => element.text !== '');
    if (found) return found.text;
  }
  return '';
}

function attribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attributes);
  return cleanValue(match?.[1] ?? match?.[2] ?? '');
}

const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** A `YYYY`, `YYYY-MM` or `YYYY-MM-DD` date that exists; anything longer (a time) is cut to its date. */
function releaseDate(value: string): string | null {
  const day = value.slice(0, 10);
  const match = DATE_PATTERN.exec(day);
  if (!match) return null;
  const [, year, month, date] = match;
  if (month === undefined) return day;
  const m = Number(month);
  if (m < 1 || m > 12) return null;
  if (date === undefined) return day;
  const daysInMonth = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
  return Number(date) >= 1 && Number(date) <= daysInMonth ? day : null;
}

function creditRole(attributes: string): CreditRole {
  const role = attribute(attributes, 'role').toLowerCase();
  return (CREDIT_ROLES as readonly string[]).includes(role) ? (role as CreditRole) : 'author';
}

/**
 * The metadata a `.nfo` holds: `<title>`, `<series>`, `<volume>` (or `<number>`), the date from
 * `<releasedate>`, `<premiered>` or `<year>`, `<language>` (a 2 or 3 letter code) and one
 * `<author role="writer">Name</author>` per credit (`<writer>`/`<artist>`… are read too; a missing or
 * unknown role is `author`). Only the fields present and valid are in the result, which is `null`
 * when the file holds nothing usable.
 */
export function parseNfo(text: string): MetadataUpdate | null {
  const update: MetadataUpdate = {};

  const title = firstText(text, 'title');
  if (title) update.title = title;
  const series = firstText(text, 'series');
  if (series) update.series = series;
  const volume = firstText(text, 'volume', 'number');
  if (volume) update.volume = volume;
  const date = releaseDate(firstText(text, 'releasedate', 'premiered', 'year'));
  if (date) update.releaseDate = date;
  const language = firstText(text, 'language').toLowerCase();
  if (/^[a-z]{2,3}$/.test(language)) update.language = language;

  const credits: CreditInput[] = [];
  const addCredit = (name: string, role: CreditRole) => {
    const person = splitPersonName(name);
    if (person.lastName !== '') credits.push({ ...person, role });
  };
  for (const author of elements(text, 'author')) addCredit(author.text, creditRole(author.attributes));
  for (const role of CREDIT_ROLES.filter((r) => r !== 'author')) {
    for (const element of elements(text, role)) addCredit(element.text, role);
  }
  if (credits.length > 0) update.credits = credits.slice(0, MAX_CREDITS);

  return Object.keys(update).length > 0 ? update : null;
}

/** The `.nfo` that goes with a comic: same folder, same name. */
export function nfoPathFor(comicPath: string): string {
  return path.join(path.dirname(comicPath), `${path.basename(comicPath, path.extname(comicPath))}.nfo`);
}

/**
 * Reads the `.nfo` next to `comicPath`. `null` when there is none, when it is not a regular file
 * or is larger than `MAX_NFO_BYTES`, when it can't be read, or when it holds nothing usable: a
 * sidecar never makes an addition fail.
 */
export async function readNfoFor(comicPath: string): Promise<MetadataUpdate | null> {
  const nfo = nfoPathFor(comicPath);
  try {
    const info = await stat(nfo);
    if (!info.isFile() || info.size > MAX_NFO_BYTES) return null;
    return parseNfo(await readFile(nfo, 'utf8'));
  } catch {
    return null;
  }
}
