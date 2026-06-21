import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Locale integrity — the front-line defense against the "renders a raw i18n key
// or blank label, but the E2E suite is green because it only checks structure"
// failure mode. Asserts every namespace has tr/en key parity, no empty values,
// and no value left equal to its own key (an untranslated placeholder). Also
// pins the enum maps the UI depends on so a missing label is a unit failure, not
// a silent "undefined" in the browser.

const LOCALES_DIR = resolve(__dirname, "locales");
const TR = resolve(LOCALES_DIR, "tr");
const EN = resolve(LOCALES_DIR, "en");

type Json = Record<string, unknown>;
const load = (loc: string, ns: string): Json =>
  JSON.parse(readFileSync(resolve(LOCALES_DIR, loc, `${ns}.json`), "utf8"));

/** Flatten nested keys to dotted paths -> string values. */
function flatten(obj: Json, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v as Json, key, out);
    else out[key] = String(v);
  }
  return out;
}

const namespaces = readdirSync(TR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

describe("locale integrity", () => {
  it("has at least the core namespaces", () => {
    expect(namespaces).toContain("common");
    expect(namespaces).toContain("admin");
    expect(namespaces.length).toBeGreaterThanOrEqual(15);
  });

  for (const ns of namespaces) {
    describe(`namespace: ${ns}`, () => {
      const tr = flatten(load("tr", ns));
      const en = flatten(load("en", ns));

      it("tr and en have identical key sets", () => {
        const trKeys = Object.keys(tr).sort();
        const enKeys = Object.keys(en).sort();
        const missingInEn = trKeys.filter((k) => !(k in en));
        const missingInTr = enKeys.filter((k) => !(k in tr));
        expect(missingInEn, `keys missing in en/${ns}`).toEqual([]);
        expect(missingInTr, `keys missing in tr/${ns}`).toEqual([]);
      });

      it("has no asymmetrically-empty values (missing translation)", () => {
        // A value empty in BOTH locales is an intentional structural token (e.g.
        // auth register.termsIntro, a composed sentence). Empty in exactly ONE
        // locale is a real missing translation — that is the defect we catch.
        const keys = new Set([...Object.keys(tr), ...Object.keys(en)]);
        const oneSided = [...keys].filter((k) => {
          const a = (tr[k] ?? "").trim() === "";
          const b = (en[k] ?? "").trim() === "";
          return a !== b;
        });
        expect(oneSided, `asymmetrically-empty (translated in one locale only) in ${ns}`).toEqual([]);
      });

      it("has no value left equal to its key (untranslated placeholder)", () => {
        // A value identical to its dotted key (e.g. "foo.bar":"foo.bar") means the
        // string was never translated. Interpolation-only tokens are exempt.
        const leaks = Object.entries(tr).filter(([k, v]) => v === k || v === `${ns}:${k}`);
        expect(leaks.map(([k]) => k), `untranslated keys in tr/${ns}`).toEqual([]);
      });
    });
  }
});

describe("enum maps cover the values the UI renders", () => {
  const common = { tr: flatten(load("tr", "common")), en: flatten(load("en", "common")) };
  const admin = { tr: flatten(load("tr", "admin")), en: flatten(load("en", "admin")) };

  // The fact-report UI offers exactly these categories (isletme/[id]/bilgi-ekle).
  // NOTE: the DB CHECK also allows 'ownership' but the UI never sets it, so it is
  // intentionally excluded here; see handoff 13 for the schema/UI mismatch.
  const expected: Record<string, { src: typeof common | typeof admin; keys: string[] }> = {
    "entityType": { src: common, keys: ["business", "product", "brand"] },
    "userType": { src: common, keys: ["consumer", "business_owner", "admin"] },
    "credibility": { src: common, keys: ["novice", "contributor", "trusted", "expert"] },
    "verification": { src: common, keys: ["pending", "verified", "disputed", "needs_review", "retracted"] },
    "factCategory": { src: common, keys: ["safety", "health", "quality", "legal", "environmental", "abuse", "labor", "other"] },
    "listings.status": { src: admin, keys: ["active", "pending", "removed"] },
    "reviews.status": { src: admin, keys: ["active", "hidden", "removed"] },
    "facts.verification": { src: admin, keys: ["pending", "verified", "disputed", "retracted"] },
    "claims.role": { src: admin, keys: ["owner", "manager", "employee"] },
  };

  for (const [path, { src, keys }] of Object.entries(expected)) {
    for (const key of keys) {
      it(`${path}.${key} has a non-empty tr + en label`, () => {
        expect(src.tr[`${path}.${key}`], `tr ${path}.${key}`).toBeTruthy();
        expect(src.en[`${path}.${key}`], `en ${path}.${key}`).toBeTruthy();
      });
    }
  }
});
