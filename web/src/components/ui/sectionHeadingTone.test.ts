import { describe, it, expect } from "vitest";
import { pipToneClass, type PipTone } from "./sectionHeadingTone";

describe("pipToneClass", () => {
  const tones: PipTone[] = ["verified", "disputed", "alert", "primary", "amber"];
  it.each(tones)("maps %s to a static bilinc bg class", (tone) => {
    const cls = pipToneClass(tone);
    expect(cls).toMatch(/^bg-bilinc-/);
  });
  it("returns empty string for undefined (no pip)", () => {
    expect(pipToneClass(undefined)).toBe("");
  });
});
