/**
 * Editing the organized folder's tree (`AppSettings.libraryStructure`) in Paramètres › Bibliothèque.
 * @module
 */
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

/** The folder each level gives the sample album of {@link structureExample}. */
const SAMPLE: Record<Exclude<LibraryLevel, 'letter'>, string> = {
  year: '1960',
  author: 'Hergé',
  series: 'Tintin',
  album: 'Tintin au Tibet',
};

/**
 * Where `structure` puts a sample album (Tintin au Tibet, by Hergé, 1960), for the settings page:
 * `T/Tintin/Tintin au Tibet.cbz` for `['letter', 'series']`. Empty for the default layout, which the
 * page describes in words.
 */
export function structureExample(structure: readonly LibraryLevel[]): string {
  if (structure.length === 0) return '';
  const folders: string[] = [];
  for (let index = structure.length - 1; index >= 0; index -= 1) {
    const level = structure[index];
    folders.unshift(level === 'letter' ? (folders[0]?.[0]?.toUpperCase() ?? '#') : SAMPLE[level]);
  }
  return [...folders, 'Tintin au Tibet.cbz'].join('/');
}
