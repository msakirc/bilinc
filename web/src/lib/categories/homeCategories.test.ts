import { describe, it, expect } from "vitest";
import { HOME_CATEGORIES, categoryName } from "./homeCategories";

describe("HOME_CATEGORIES", () => {
  it("has 6 entries with real kebab slugs", () => {
    expect(HOME_CATEGORIES.length).toBe(6);
    for (const c of HOME_CATEGORIES) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.name_en.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
  it("slugs are unique", () => {
    expect(new Set(HOME_CATEGORIES.map((c) => c.slug)).size).toBe(HOME_CATEGORIES.length);
  });
  it("categoryName resolves by language", () => {
    const c = HOME_CATEGORIES[0];
    expect(categoryName(c, "tr")).toBe(c.name);
    expect(categoryName(c, "en")).toBe(c.name_en);
    expect(categoryName(c, "de")).toBe(c.name); // non-en falls back to Turkish canonical
  });
});
