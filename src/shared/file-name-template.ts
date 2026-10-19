/**
 * The file name template of the library organization (`AppSettings.libraryFileName`): text with
 * `{series}`, `{volume}`, `{title}`, `{year}` and `{author}` fields, filled from a library entry.
 * @module
 */

/** The fields an `AppSettings.libraryFileName` template may hold, each written `{field}`. */
export const FILE_NAME_FIELDS = ['series', 'volume', 'title', 'year', 'author'] as const;

/** A field of a file name template. */
export type FileNameField = (typeof FILE_NAME_FIELDS)[number];

/** Longest file name template accepted, in characters. */
export const MAX_FILE_NAME_TEMPLATE_LENGTH = 200;

const FIELD = /\{(series|volume|title|year|author)\}/g;
const FIELD_TEST = /\{(?:series|volume|title|year|author)\}/;
const FIELD_SPLIT = /\{(series|volume|title|year|author)\}/;

/**
 * Why `template` can't be a file name template, or null when it can: `separator` for a `/` or `\`
 * (it names a file, not folders), `braces` for a `{` or `}` outside a known field (`{serie}`, `{`),
 * `length` beyond {@link MAX_FILE_NAME_TEMPLATE_LENGTH}. The empty template is valid: it keeps the
 * original file names.
 */
export function fileNameTemplateError(template: string): 'separator' | 'braces' | 'length' | null {
  if (template.length > MAX_FILE_NAME_TEMPLATE_LENGTH) return 'length';
  if (/[/\\]/.test(template)) return 'separator';
  if (/[{}]/.test(template.replace(FIELD, ''))) return 'braces';
  return null;
}

/** Whether `value` is a usable file name template (see {@link fileNameTemplateError}). */
export function isFileNameTemplate(value: unknown): value is string {
  return typeof value === 'string' && fileNameTemplateError(value) === null;
}

/**
 * `template` with each field replaced by its value: `{series} - T{volume} - {title}` gives
 * `Tintin - T20 - Tintin au Tibet`. The result isn't made safe for the file system: the caller does it.
 */
export function fillFileNameTemplate(template: string, values: Record<FileNameField, string>): string {
  return template.replace(FIELD, (_, field: FileNameField) => values[field]);
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
  if (!isFileNameTemplate(template) || !FIELD_TEST.test(template)) return null;
  const fields: FileNameField[] = [];
  const source = spaced(template)
    .split(FIELD_SPLIT)
    .map((part, index) => {
      if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      fields.push(part as FileNameField);
      return part === 'year' ? '(\\d{4})' : part === 'volume' ? '(\\S+?)' : '(.+?)';
    })
    .join('');
  const match = new RegExp(`^${source}$`, 'i').exec(spaced(name));
  if (!match) return null;
  const parsed: ParsedFileName = {};
  fields.forEach((field, index) => {
    parsed[field] ??= match[index + 1].trim();
  });
  return parsed;
}
