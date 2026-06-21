import { describe, it, expect } from "vitest";
import { buttonClasses } from "./buttonVariants";

describe("buttonClasses", () => {
  it("primary uses the green token + white text", () => {
    const c = buttonClasses("primary", "md");
    expect(c).toContain("bg-bilinc-primary");
    expect(c).toContain("text-white");
  });

  it("amber is the contribute/action variant", () => {
    expect(buttonClasses("amber", "md")).toContain("bg-bilinc-amber");
  });

  it("outline and ghost are transparent-bg variants", () => {
    expect(buttonClasses("outline", "md")).toContain("border");
    expect(buttonClasses("ghost", "md")).not.toContain("bg-bilinc-primary");
  });

  it("size changes padding", () => {
    expect(buttonClasses("primary", "sm")).not.toEqual(buttonClasses("primary", "lg"));
  });
});
