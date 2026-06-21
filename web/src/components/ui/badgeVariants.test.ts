import { describe, it, expect } from "vitest";
import { badgeVariantClass } from "./Badge";

describe("badgeVariantClass", () => {
  it("keeps existing variants intact", () => {
    expect(badgeVariantClass("verified")).toContain("bilinc-verified");
    expect(badgeVariantClass("primary")).toContain("bilinc-primary");
  });

  it("adds an amber variant on the soft amber bg", () => {
    expect(badgeVariantClass("amber")).toContain("bilinc-amber-soft");
    expect(badgeVariantClass("amber")).toContain("text-bilinc-amber");
  });

  it("falls back to default for unknown", () => {
    expect(badgeVariantClass("nope")).toEqual(badgeVariantClass("default"));
  });
});
