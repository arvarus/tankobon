/**
 * Editing the organized folder's tree (`AppSettings.libraryStructure`) and file name template
 * (`AppSettings.libraryFileName`) in Paramètres › Bibliothèque.
 * @module
 */
import { fillFileNameTemplate } from '@/shared/file-name-template';
import { LIBRARY_LEVELS, MAX_LIBRARY_LEVELS, type LibraryLevel } from '@/shared/settings';

/**
 * The levels the select of position `index` (0-based) may offer, given the rest of `structure`:
 * none past the first free position, `letter` and `year` only first, and no level used at another
 * position.
 */
export function levelChoices(structure: readonly LibraryLevel[], index: number): LibraryLevel[] {
  if (index >= MAX_LIBRARY_LEVELS || index > structure.length) return [];
  return LIBRARY_LEVELS.filter(
    (level) =>
      (index === 0 || (level !== 'letter' && level !== 'year')) &&
      !structure.some((used, position) => used === level && position !== index),
  );
}

/**
 * `structure` with position `index` set to `level`; `null` empties that position and the ones after
 * it. A first level changed to anything but `letter`/`year` keeps the levels after it; changed to one
 * of them, it drops a later `letter`/`year` (which can't happen) and any duplicate.
 */
export function setLevel(structure: readonly LibraryLevel[], index: number, level: LibraryLevel | null): LibraryLevel[] {
  if (level === null) return structure.slice(0, index);
  const next = [...structure];
  next[index] = level;
  return next.filter(
    (item, position) => next.indexOf(item) === position && (position === 0 || (item !== 'letter' && item !== 'year')),
  );
}

/** The sample album of the examples (Tintin au Tibet, Tintin volume 20, by Hergé, 1960). */
const SAMPLE = {
  series: 'Tintin',
  volume: '20',
  title: 'Tintin au Tibet',
  year: '1960',
  author: 'Hergé',
};

/** The folder each level gives the sample album. */
const SAMPLE_FOLDERS: Record<Exclude<LibraryLevel, 'letter'>, string> = {
  year: SAMPLE.year,
  author: SAMPLE.author,
  series: SAMPLE.series,
  album: SAMPLE.title,
};

/**
 * The file name the template `fileName` gives the sample album, extension included:
 * `Tintin - T20 - Tintin au Tibet.cbz` for `{series} - T{volume} - {title}`, `Tintin au Tibet.cbz`
 * (its original name) for the empty template.
 */
export function fileNameExample(fileName: string, volumePrefix = '', prefixNumericOnly = false): string {
  const name = fileName === '' ? SAMPLE.title : fillFileNameTemplate(fileName, SAMPLE, volumePrefix, prefixNumericOnly).trim();
  return `${name}.cbz`;
}

/**
 * Where `structure` puts the sample album, named by the template `fileName`, for the settings page:
 * `T/Tintin/Tintin au Tibet.cbz` for `['letter', 'series']` and no template. Empty for the default
 * layout, which the page describes in words.
 */
export function structureExample(
  structure: readonly LibraryLevel[],
  fileName = '',
  volumePrefix = '',
  prefixNumericOnly = false,
): string {
  if (structure.length === 0) return '';
  const folders: string[] = [];
  for (let index = structure.length - 1; index >= 0; index -= 1) {
    const level = structure[index];
    folders.unshift(level === 'letter' ? (folders[0]?.[0]?.toUpperCase() ?? '#') : SAMPLE_FOLDERS[level]);
  }
  return [...folders, fileNameExample(fileName, volumePrefix, prefixNumericOnly)].join('/');
}
