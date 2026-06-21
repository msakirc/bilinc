import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "fonts.ts"), "utf8");

describe("font config", () => {
  it("imports Fraunces and Inter from next/font/google", () => {
    expect(src).toMatch(/import\s*\{[^}]*Fraunces[^}]*\}\s*from\s*["']next\/font\/google["']/);
    expect(src).toMatch(/import\s*\{[^}]*Inter[^}]*\}\s*from\s*["']next\/font\/google["']/);
  });

  it("includes the latin-ext subset (Turkish glyphs: İ ı ğ ş)", () => {
    const latinExtCount = (src.match(/latin-ext/g) || []).length;
    expect(latinExtCount).toBeGreaterThanOrEqual(2);
  });

  it("exposes both as CSS variables", () => {
    expect(src).toContain("--font-fraunces");
    expect(src).toContain("--font-inter");
  });
});
