/**
 * The file name template of the library organization (`AppSettings.libraryFileName`): text with
 * `{series}`, `{volume}`, `{title}`, `{year}` and `{author}` fields, filled from a library entry. `{volume}`
 * also takes a width, `{volume:2}`, that pads a numeric volume with leading zeros (`7` → `07`).
 * @module
 */

/** The fields an `AppSettings.libraryFileName` template may hold, each written `{field}`. */
export const FILE_NAME_FIELDS = ['series', 'volume', 'title', 'year', 'author'] as const;

/** A field of a file name template. */
export type FileNameField = (typeof FILE_NAME_FIELDS)[number];

/** Longest file name template accepted, in characters. */
export const MAX_FILE_NAME_TEMPLATE_LENGTH = 200;

/** Widest zero padding of `{volume:N}`. */
export const MAX_VOLUME_PADDING = 4;

// A field is `{name}`, and `{volume}` also `{volume:N}` with N from 1 to MAX_VOLUME_PADDING.
const FIELD = /\{(series|volume|title|year|author)(?::([1-4]))?\}/g;
const VALID_FIELD = /\{(?:series|title|year|author|volume(?::[1-4])?)\}/g;
const VALID_FIELD_TEST = /\{(?:series|title|year|author|volume(?::[1-4])?)\}/;

/**
 * Why `template` can't be a file name template, or null when it can: `separator` for a `/` or `\`
 * (it names a file, not folders), `braces` for a `{` or `}` outside a known field (`{serie}`, `{`),
 * `length` beyond {@link MAX_FILE_NAME_TEMPLATE_LENGTH}. The empty template is valid: it keeps the
 * original file names.
 */
export function fileNameTemplateError(template: string): 'separator' | 'braces' | 'length' | null {
  if (template.length > MAX_FILE_NAME_TEMPLATE_LENGTH) return 'length';
  if (/[/\\]/.test(template)) return 'separator';
  if (/[{}]/.test(template.replace(VALID_FIELD, ''))) return 'braces';
  return null;
}

/** Whether `value` is a usable file name template (see {@link fileNameTemplateError}). */
export function isFileNameTemplate(value: unknown): value is string {
  return typeof value === 'string' && fileNameTemplateError(value) === null;
}

/**
 * `volume` padded with leading zeros to `width` digits when it is a plain whole number (`7` → `07`, `12` →
 * `12` for a width of 2); any other volume (`HS`, `12.1`, `1/2`, `3-4`) is returned as it is.
 */
export function padVolume(volume: string, width: number): string {
  return /^\d+$/.test(volume) ? volume.padStart(width, '0') : volume;
}

/** Longest volume prefix accepted (`AppSettings.libraryVolumePrefix`), in characters. */
export const MAX_VOLUME_PREFIX_LENGTH = 20;

/** Whether `value` can be a volume prefix: short, with no path separator nor control character. */
export function isVolumePrefix(value: unknown): value is string {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' && value.length <= MAX_VOLUME_PREFIX_LENGTH && !/[/\\\u0000-\u001f]/.test(value);
}

/**
 * `volume` with `prefix` in front (`T` and `7` give `T7`). An empty volume stays empty, so it is still left
 * out of the name; with `numericOnly`, only a plain whole number gets the prefix (`HS` and `12.1` stay as they are).
 */
export function prefixVolume(volume: string, prefix: string, numericOnly: boolean): string {
  if (volume === '' || prefix === '') return volume;
  return numericOnly && !/^\d+$/.test(volume) ? volume : prefix + volume;
}

// A `{volume}` field with the text glued before it (`T` of `T{volume}`) and the separator that precedes it.
const VOLUME_WITH_PREFIX = /(?:\s+[-–—_,.:;]+\s*|\s+)?[^\s{}]*\{volume(?::[1-4])?\}/g;

/**
 * `template` with each field replaced by its value: `{series} - T{volume} - {title}` gives
 * `Tintin - T20 - Tintin au Tibet`, and `T{volume:2}` gives `T07` for the volume 7. An empty volume is
 * left out with the text glued before the field and the separator before that: the same template gives
 * `Tintin - Tintin au Tibet`. With `volumePrefix`, each `{volume}` is written with it in front, after the
 * padding (`T` and `{volume:2}` give `T07`); `prefixNumericOnly` keeps it off a volume that isn't a whole
 * number. The result isn't made safe for the file system: the caller does it.
 */
export function fillFileNameTemplate(
  template: string,
  values: Record<FileNameField, string>,
  volumePrefix = '',
  prefixNumericOnly = false,
): string {
  const source = values.volume === '' ? template.replace(VOLUME_WITH_PREFIX, '').replace(/^[\s\-–—_,.:;]+/, '') : template;
  return source.replace(FIELD, (match, field: FileNameField, width: string | undefined) => {
    if (field !== 'volume') return width === undefined ? values[field] : match;
    const volume = width === undefined ? values.volume : padVolume(values.volume, Number(width));
    return prefixVolume(volume, volumePrefix, prefixNumericOnly);
  });
}

/** What {@link parseFileName} reads out of a file name: the fields the template names and the name holds. */
export type ParsedFileName = Partial<Record<FileNameField, string>>;

/** `_` as a word separator is the same as a space; runs of blanks are one. */
function spaced(text: string): string {
  return text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Reads a file name (without its extension) with a template written like `libraryFileName`, the
 * reverse of {@link fillFileNameTemplate}: with `{series} - T{volume}`, `Tintin - T20` gives
 * `{ series: 'Tintin', volume: '20' }`. The whole name has to match; `null` when it doesn't, or when
 * the template has no field. `_` counts as a space on both sides, the empty template matches nothing.
 */
export function parseFileName(name: string, template: string): ParsedFileName | null {
  if (!isFileNameTemplate(template) || !VALID_FIELD_TEST.test(template)) return null;
  const fields: FileNameField[] = [];
  // Whether each field was written with a padding width (`{volume:2}`).
  const padded: boolean[] = [];
  const spacedTemplate = spaced(template);
  let source = '';
  let last = 0;
  for (const match of spacedTemplate.matchAll(FIELD)) {
    source += escapeRegExp(spacedTemplate.slice(last, match.index));
    last = match.index + match[0].length;
    const field = match[1] as FileNameField;
    fields.push(field);
    padded.push(match[2] !== undefined);
    source += field === 'year' ? '(\\d{4})' : field === 'volume' ? '(\\S+?)' : '(.+?)';
  }
  source += escapeRegExp(spacedTemplate.slice(last));
  const found = new RegExp(`^${source}$`, 'i').exec(spaced(name));
  if (!found) return null;
  const parsed: ParsedFileName = {};
  fields.forEach((field, index) => {
    const value = found[index + 1].trim();
    // Zeros added by a `{volume:N}` padding (and only those) are not part of the volume: `07` is the volume `7`.
    parsed[field] ??= padded[index] ? value.replace(/^0+(?=\d)/, '') : value;
  });
  return parsed;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
