/**
 * Reads the `.nfo` file that can sit next to a comic (same name, `.nfo` extension) and turns it
 * into the metadata of the book. The file is user-supplied text, so nothing in it is trusted:
 * it is read through a size cap, tags are matched flatly (no XML parser, hence no entities beyond
 * the five predefined ones, no DTD, no external reference), every value is cleaned and bounded, and
 * a value that doesn't fit its field is dropped.
 * @module
 */
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CREDIT_ROLES, type CreditInput, type CreditRole, type LibraryEntry, type MetadataUpdate } from '../../shared/library';
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

/** Longest raw text looked at when cleaning one value: values are cut to {@link MAX_VALUE_LENGTH} anyway. */
const MAX_RAW_LENGTH = 4000;
/** Most elements of one name taken from a file. */
const MAX_ELEMENTS = 200;

/** `text` without its `<…>` tags (an unclosed `<` stays as text), in one pass. */
function stripTags(text: string): string {
  let result = '';
  let from = 0;
  for (;;) {
    const open = text.indexOf('<', from);
    if (open === -1) break;
    const close = text.indexOf('>', open);
    // No `>` left: no later `<` can close either.
    if (close === -1) break;
    result += `${text.slice(from, open)} `;
    from = close + 1;
  }
  return result + text.slice(from);
}

/** `text` with its `<![CDATA[…]]>` wrappers removed (an unclosed one stays as text), in one pass. */
function unwrapCdata(text: string): string {
  let result = '';
  let from = 0;
  for (;;) {
    const open = text.indexOf('<![CDATA[', from);
    if (open === -1) break;
    const close = text.indexOf(']]>', open + 9);
    if (close === -1) break;
    result += text.slice(from, open) + text.slice(open + 9, close);
    from = close + 3;
  }
  return result + text.slice(from);
}

/** The text of a value: CDATA unwrapped, entities decoded, control characters and extra spaces removed, cut to length. */
function cleanValue(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const text = decode(stripTags(unwrapCdata(raw.slice(0, MAX_RAW_LENGTH)))).replace(/[\u0000-\u001f\u007f]/g, ' ');
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_LENGTH);
}

interface Element {
  attributes: string;
  text: string;
}

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/**
 * Every `<name …>text</name>` of the file, in order (names compared ignoring case), at most
 * {@link MAX_ELEMENTS}. Found with `indexOf` rather than a lazy regex, which re-scans the rest of the file
 * for each opening tag that has no closing one: a 256 KiB file of `<author>` took seconds.
 */
function elements(xml: string, name: string): Element[] {
  const lower = xml.toLowerCase();
  const open = `<${name.toLowerCase()}`;
  const close = `</${name.toLowerCase()}`;
  const found: Element[] = [];
  let from = 0;
  while (found.length < MAX_ELEMENTS) {
    const start = lower.indexOf(open, from);
    if (start === -1) break;
    const afterName = start + open.length;
    const next = xml[afterName];
    if (next !== '>' && !isSpace(next)) {
      from = afterName;
      continue;
    }
    const tagEnd = xml.indexOf('>', afterName);
    if (tagEnd === -1) break;
    // A closing tag is `</name`, optional spaces, `>`; one that isn't is skipped.
    let end = lower.indexOf(close, tagEnd + 1);
    let afterClose = -1;
    while (end !== -1) {
      let cursor = end + close.length;
      while (isSpace(xml[cursor])) cursor++;
      if (xml[cursor] === '>') {
        afterClose = cursor + 1;
        break;
      }
      end = lower.indexOf(close, end + close.length);
    }
    // No closing tag here: none can follow a later opening tag either.
    if (afterClose === -1) break;
    found.push({
      attributes: xml.slice(afterName, tagEnd).slice(0, 1000),
      text: cleanValue(xml.slice(tagEnd + 1, end)),
    });
    from = afterClose;
  }
  return found;
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

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The `.nfo` text describing a library entry, in the shape `parseNfo()` reads back: the title, the
 * series, volume, date and language when known, and one `<author role="…">First Last</author>` per credit.
 */
export function buildNfo(entry: Pick<LibraryEntry, 'title' | 'series' | 'volume' | 'releaseDate' | 'language' | 'credits'>): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<book>', `  <title>${escapeXml(entry.title)}</title>`];
  const fields: [string, string | null][] = [
    ['series', entry.series],
    ['volume', entry.volume],
    ['releasedate', entry.releaseDate],
    ['language', entry.language],
  ];
  for (const [name, value] of fields) {
    if (value) lines.push(`  <${name}>${escapeXml(value)}</${name}>`);
  }
  for (const credit of entry.credits) {
    const name = [credit.firstName, credit.lastName].filter(Boolean).join(' ');
    lines.push(`  <author role="${credit.role}">${escapeXml(name)}</author>`);
  }
  lines.push('</book>', '');
  return lines.join('\n');
}

/**
 * Writes the `.nfo` of a library entry next to its comic, replacing the one that is there: the
 * user just accepted new information for it. Returns whether the file was written; any failure
 * (read-only folder, file gone) is reported as `false`, the information being saved in the library
 * anyway.
 */
export async function writeNfo(entry: Parameters<typeof buildNfo>[0] & { path: string }): Promise<boolean> {
  const target = nfoPathFor(entry.path);
  // Written aside then renamed: `rename` replaces a symbolic link itself, where `writeFile` would write
  // through it into whatever it points at (a link planted in a folder of comics).
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, buildNfo(entry), { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
    return true;
  } catch {
    await rm(temporary, { force: true }).catch(() => undefined);
    return false;
  }
}

/**
 * Writes the `.nfo` of a library entry next to its comic unless one is already there (whatever it
 * holds, it is never overwritten). Returns whether a file was created; any failure (read-only
 * folder, file gone) is reported as `false`: a sidecar never makes a resynchronization fail.
 */
export async function writeNfoIfMissing(entry: Parameters<typeof buildNfo>[0] & { path: string }): Promise<boolean> {
  try {
    await writeFile(nfoPathFor(entry.path), buildNfo(entry), { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}
