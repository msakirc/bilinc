import { describe, it, expect } from "vitest";
import { isDismissKey } from "./dismiss";

describe("isDismissKey", () => {
  it("treats Escape as a dismiss key", () => {
    expect(isDismissKey("Escape")).toBe(true);
  });
  it("treats Esc (legacy) as a dismiss key", () => {
    expect(isDismissKey("Esc")).toBe(true);
  });
  it("ignores other keys", () => {
    expect(isDismissKey("Enter")).toBe(false);
    expect(isDismissKey("a")).toBe(false);
    expect(isDismissKey("")).toBe(false);
  });
});
