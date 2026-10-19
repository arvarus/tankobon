/**
 * What the lookup dialog searches for when it opens, and the file name rules it offers when the
 * book has no information yet. Pure, so it can be tested without the dialog.
 * @module
 */
import { type ParsedFileName, parseFileName } from '@/shared/file-name-template';
import type { LibraryEntry } from '@/shared/library';
import type { MetadataQuery } from '@/shared/metadata';
import { MAX_FILE_NAME_RULES } from '@/shared/settings';

import { hasFiche } from './library-filter';

/** The file's name without its folder and extension: `/books/Blacksad_T02.cbz` gives `Blacksad_T02`. */
export function fileStem(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * The search the dialog opens with: the book's own series and volume (or its title) when it has
 * information, else the file name as it is, for the user to read with a rule or edit.
 */
export function initialLookupQuery(entry: LibraryEntry): MetadataQuery {
  if (hasFiche(entry)) {
    return entry.series ? { text: entry.series, volume: entry.volume } : { text: entry.title, volume: entry.volume };
  }
  return { text: fileStem(entry.path), volume: null };
}

/** The search a read file name gives: the series (else the title, else the author) and the volume. */
export function queryFromParsedName(parsed: ParsedFileName): MetadataQuery | null {
  const text = parsed.series ?? parsed.title ?? parsed.author;
  return text ? { text, volume: parsed.volume ?? null } : null;
}

/** Reads `entry`'s file name with `rule`; null when the name doesn't fit the rule or gives nothing to search. */
export function queryFromRule(entry: LibraryEntry, rule: string): MetadataQuery | null {
  const parsed = parseFileName(fileStem(entry.path), rule);
  return parsed ? queryFromParsedName(parsed) : null;
}

/**
 * The rules to offer: those used before (most recent first), then the library's file name template,
 * written the same way, without repeats.
 */
export function offeredRules(used: readonly string[], libraryFileName: string): string[] {
  return [...new Set([...used, libraryFileName].filter((rule) => rule !== ''))];
}

/** The rules to store after using `rule`: it comes first, the previous uses follow, the oldest ones are dropped. */
export function rememberRule(used: readonly string[], rule: string): string[] {
  return [rule, ...used.filter((other) => other !== rule)].slice(0, MAX_FILE_NAME_RULES);
}
