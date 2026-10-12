/**
 * The home page's blocks and their settings (pure, no DOM).
 * @module
 */
import { HOME_SECTIONS, type HomeSectionSetting } from "@/shared/settings";

import { moveItem } from "./reading-list";

/**
 * The stored blocks completed with the ones it doesn't know yet (a block added by a later release),
 * appended in default order and shown, so the result always holds every block exactly once.
 */
export function resolveHomeSections(
  stored: readonly HomeSectionSetting[],
): HomeSectionSetting[] {
  const known = new Set(stored.map((section) => section.id));
  return [
    ...stored,
    ...HOME_SECTIONS.filter((id) => !known.has(id)).map((id) => ({
      id,
      visible: true,
    })),
  ];
}

/** The blocks to draw, in order: the resolved list without the hidden ones. */
export function visibleHomeSections(
  stored: readonly HomeSectionSetting[],
): HomeSectionSetting["id"][] {
  return resolveHomeSections(stored)
    .filter((section) => section.visible)
    .map((section) => section.id);
}

/** The resolved list with the block at `index` moved by `delta` places; unchanged at either end. */
export function moveHomeSection(
  stored: readonly HomeSectionSetting[],
  index: number,
  delta: -1 | 1,
): HomeSectionSetting[] {
  const sections = resolveHomeSections(stored);
  return moveItem(sections, index, index + delta) ?? sections;
}

/** The resolved list with the block `id` shown or hidden. */
export function setHomeSectionVisible(
  stored: readonly HomeSectionSetting[],
  id: HomeSectionSetting["id"],
  visible: boolean,
): HomeSectionSetting[] {
  return resolveHomeSections(stored).map((section) =>
    section.id === id ? { ...section, visible } : section,
  );
}
