import { describe, expect, it } from "vitest";

import { isHomeSections } from "@/shared/settings";

import {
  moveHomeSection,
  resolveHomeSections,
  setHomeSectionVisible,
  visibleHomeSections,
} from "./home-sections";

describe("home sections", () => {
  it("appends the blocks missing from the stored list, shown", () => {
    expect(resolveHomeSections([])).toEqual([
      { id: "secondChance", visible: true },
    ]);
    expect(
      resolveHomeSections([{ id: "secondChance", visible: false }]),
    ).toEqual([{ id: "secondChance", visible: false }]);
  });

  it("lists only the visible blocks", () => {
    expect(
      visibleHomeSections([{ id: "secondChance", visible: false }]),
    ).toEqual([]);
    expect(visibleHomeSections([])).toEqual(["secondChance"]);
  });

  it("shows or hides a block", () => {
    expect(setHomeSectionVisible([], "secondChance", false)).toEqual([
      { id: "secondChance", visible: false },
    ]);
  });

  it("leaves the list alone when a move goes past either end", () => {
    expect(moveHomeSection([], 0, -1)).toEqual([
      { id: "secondChance", visible: true },
    ]);
    expect(moveHomeSection([], 0, 1)).toEqual([
      { id: "secondChance", visible: true },
    ]);
  });

  it("validates the stored list", () => {
    expect(isHomeSections([])).toBe(true);
    expect(isHomeSections([{ id: "secondChance", visible: true }])).toBe(true);
    expect(isHomeSections([{ id: "nope", visible: true }])).toBe(false);
    expect(isHomeSections([{ id: "secondChance", visible: 1 }])).toBe(false);
    expect(
      isHomeSections([
        { id: "secondChance", visible: true },
        { id: "secondChance", visible: false },
      ]),
    ).toBe(false);
    expect(isHomeSections("secondChance")).toBe(false);
  });
});
