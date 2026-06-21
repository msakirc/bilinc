import { describe, it, expect } from "vitest";
import { categoryIcon } from "./categoryIcon";

// Guards the fix for the prod bug where PROD's categories.icon stores
// @expo/vector-icons Ionicon NAMES while staging stores emoji; web must render a
// glyph for either form.

const isEmoji = (s: string) => /[^\x00-\x7F]/.test(s);

describe("categoryIcon", () => {
  // Every Ionicon name observed on the PROD home page.
  const PROD_IONICON_NAMES = [
    "restaurant", "heart", "shirt", "home", "laptop-outline", "car",
    "school", "ticket", "barbell", "briefcase", "bed", "paw",
  ];

  it.each(PROD_IONICON_NAMES)("maps Ionicon name %s to an emoji glyph", (name) => {
    const out = categoryIcon(name);
    expect(out).not.toBe(name);
    expect(isEmoji(out)).toBe(true);
  });

  it("is case-insensitive on the Ionicon name", () => {
    expect(categoryIcon("Restaurant")).toBe(categoryIcon("restaurant"));
    expect(categoryIcon("CAR ")).toBe(categoryIcon("car"));
  });

  it("passes an existing emoji through unchanged", () => {
    expect(categoryIcon("🍽️")).toBe("🍽️");
    expect(categoryIcon("💆")).toBe("💆");
    expect(categoryIcon("🏨")).toBe("🏨");
  });

  it("returns a neutral emoji fallback for unknown ASCII names", () => {
    expect(isEmoji(categoryIcon("totally-unknown"))).toBe(true);
  });

  it("returns a glyph for null/undefined/empty", () => {
    expect(isEmoji(categoryIcon(null))).toBe(true);
    expect(isEmoji(categoryIcon(undefined))).toBe(true);
    expect(isEmoji(categoryIcon(""))).toBe(true);
  });

  it("never returns a pure-ASCII value (which would look like a raw name)", () => {
    for (const v of [...PROD_IONICON_NAMES, "unknown", "", null, undefined]) {
      expect(isEmoji(categoryIcon(v as string))).toBe(true);
    }
  });
});
