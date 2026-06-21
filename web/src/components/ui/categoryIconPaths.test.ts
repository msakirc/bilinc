import { describe, it, expect } from "vitest";
import { CATEGORY_ICON_PATHS, iconPathFor } from "./categoryIconPaths";
import { HOME_CATEGORIES } from "@/lib/categories/homeCategories";

describe("categoryIconPaths", () => {
  it("has a path for every home category icon key", () => {
    for (const c of HOME_CATEGORIES) {
      expect(CATEGORY_ICON_PATHS[c.icon], `missing icon path for "${c.icon}"`).toBeTruthy();
    }
  });
  it("falls back to a default path for unknown keys", () => {
    expect(iconPathFor("totally-unknown")).toBe(CATEGORY_ICON_PATHS.default);
  });
  it("every path is non-empty svg path data", () => {
    for (const d of Object.values(CATEGORY_ICON_PATHS)) {
      expect(typeof d).toBe("string");
      expect(d.length).toBeGreaterThan(0);
    }
  });
});
