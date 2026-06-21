import { describe, it, expect } from "vitest";
import { isValidVKN } from "./vkn";

describe("isValidVKN — format", () => {
  it("rejects non-10-digit / non-numeric / empty input", () => {
    for (const bad of ["", "  ", "123", "12345678901", "abcdefghij", "12345abcde", "123456789", "１２３４５６７８９０"]) {
      expect(isValidVKN(bad), `"${bad}" should be invalid`).toBe(false);
    }
  });

  it("tolerates surrounding whitespace", () => {
    // Find any valid VKN, then assert padding it does not change the verdict.
    const valid = firstValidVKN("123456789");
    expect(isValidVKN(`  ${valid}  `)).toBe(isValidVKN(valid));
  });

  it("is deterministic", () => {
    const v = firstValidVKN("987654321");
    expect(isValidVKN(v)).toBe(isValidVKN(v));
  });
});

describe("isValidVKN — checksum", () => {
  // Without hard-coded official vectors we assert the defining property of a
  // mod-10 check digit: for any 9-digit prefix there is EXACTLY ONE last digit
  // that validates. This proves it's a real checksum, not a constant pass/fail.
  const PREFIXES = ["123456789", "000000000", "987654321", "111111111", "246813579"];

  it.each(PREFIXES)("has exactly one valid check digit for prefix %s", (prefix) => {
    const valid = [...Array(10).keys()].filter((d) => isValidVKN(prefix + d));
    expect(valid).toHaveLength(1);
  });

  it("rejects the 9 wrong check digits for a prefix", () => {
    const prefix = "123456789";
    const good = firstValidVKN(prefix);
    const goodLast = Number(good[9]);
    for (let d = 0; d <= 9; d++) {
      expect(isValidVKN(prefix + d)).toBe(d === goodLast);
    }
  });
});

/** Helper: brute-force the valid VKN for a 9-digit prefix via isValidVKN. */
function firstValidVKN(prefix: string): string {
  for (let d = 0; d <= 9; d++) if (isValidVKN(prefix + d)) return prefix + d;
  throw new Error(`no valid VKN for prefix ${prefix}`);
}
