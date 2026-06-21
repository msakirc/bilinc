import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

function block(selector: string): string {
  // Returns the body of the first `selector { ... }` block.
  // NOTE: assumes flat, single-occurrence blocks (true for globals.css today —
  // @theme/:root/.dark each appear once with no nested braces or comments). If
  // someone adds nesting or a @media :root, switch this to brace-counting.
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`no ${selector} block`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

const theme = block("@theme");
const root = block(":root");
const dark = block(".dark");

describe("design tokens", () => {
  const NEW_VARS = ["--amber", "--amber-soft", "--alert", "--alert-soft", "--verified-soft", "--disputed-soft", "--pending-soft"];

  it.each(NEW_VARS)("declares %s in :root", (v) => {
    expect(root).toContain(`${v}:`);
  });

  it.each(NEW_VARS)("declares %s in .dark (no transparent-in-dark bug)", (v) => {
    expect(dark).toContain(`${v}:`);
  });

  it.each(["amber", "amber-soft", "alert", "alert-soft", "verified-soft", "disputed-soft", "pending-soft"])(
    "exposes --color-bilinc-%s in @theme",
    (name) => {
      expect(theme).toContain(`--color-bilinc-${name}:`);
    }
  );
});
