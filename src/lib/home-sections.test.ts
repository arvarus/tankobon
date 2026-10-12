import { describe, expect, it } from "vitest";

import {
  HOME_SECTIONS,
  isHomeSections,
  type HomeSectionSetting,
} from "@/shared/settings";

import {
  moveHomeSection,
  resolveHomeSections,
  setHomeSectionVisible,
  visibleHomeSections,
} from "./home-sections";

const all = HOME_SECTIONS.map((id) => ({ id, visible: true }));
const ids = (sections: readonly HomeSectionSetting[]) =>
  sections.map((section) => section.id);

describe("home sections", () => {
  it("appends the blocks missing from the stored list, shown, in default order", () => {
    expect(resolveHomeSections([])).toEqual(all);
    const resolved = resolveHomeSections([
      { id: "secondChance", visible: false },
    ]);
    expect(ids(resolved)).toEqual([
      "secondChance",
      ...HOME_SECTIONS.filter((id) => id !== "secondChance"),
    ]);
    expect(resolved[0].visible).toBe(false);
  });

  it("lists only the visible blocks", () => {
    expect(visibleHomeSections([])).toEqual([...HOME_SECTIONS]);
    expect(
      visibleHomeSections([{ id: "favorites", visible: false }]),
    ).not.toContain("favorites");
  });

  it("shows or hides a block", () => {
    const hidden = setHomeSectionVisible([], "favorites", false);
    expect(hidden.find((section) => section.id === "favorites")?.visible).toBe(
      false,
    );
    expect(hidden.filter((section) => section.visible)).toHaveLength(
      HOME_SECTIONS.length - 1,
    );
  });

  it("moves a block by one place and leaves the list alone past either end", () => {
    expect(ids(moveHomeSection([], 0, 1)).slice(0, 2)).toEqual([
      HOME_SECTIONS[1],
      HOME_SECTIONS[0],
    ]);
    expect(moveHomeSection([], 0, -1)).toEqual(all);
    expect(moveHomeSection([], HOME_SECTIONS.length - 1, 1)).toEqual(all);
  });

  it("validates the stored list", () => {
    expect(isHomeSections([])).toBe(true);
    expect(isHomeSections(all)).toBe(true);
    expect(isHomeSections([{ id: "nope", visible: true }])).toBe(false);
    expect(isHomeSections([{ id: "favorites", visible: 1 }])).toBe(false);
    expect(
      isHomeSections([
        { id: "favorites", visible: true },
        { id: "favorites", visible: false },
      ]),
    ).toBe(false);
    expect(isHomeSections("favorites")).toBe(false);
  });
});
