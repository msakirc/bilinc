import { expect, type Page } from "@playwright/test";

// Detects "leaks" — rendered text that proves a data/i18n binding failed. These
// are exactly the defects the URL/testid-only suite missed (a card badge reading
// "entityType.undefined", a category tile reading the raw Ionicon name).

// i18n namespaces from CLAUDE.md — a visible "<ns>:<key>" means a missing string.
const NAMESPACES = [
  "common", "validation", "errors", "auth", "home", "business", "fact", "review",
  "profile", "activity", "settings", "search", "category", "admin", "panel",
  "legal", "chrome", "onboarding",
];

// Enum maps that live under common:* — a bare "entityType.business" leaking means
// the namespace-prefixed lookup fell through to a raw key.
const ENUM_MAPS = ["entityType", "factCategory", "verification", "credibility", "userType"];

// @expo/vector-icons Ionicon names that must never render as text on web.
export const IONICON_NAMES = [
  "restaurant", "fast-food", "cafe", "wine", "heart", "medical", "fitness",
  "barbell", "shirt", "cut", "home", "bed", "business", "briefcase", "build",
  "construct", "hammer", "laptop-outline", "laptop", "phone-portrait", "car",
  "car-sport", "bicycle", "school", "book", "library", "ticket", "film",
  "musical-notes", "paw", "basket", "cart", "pricetag", "storefront", "bag",
  "airplane", "bus", "leaf",
];

const LEAK_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "undefined-binding", re: /\.undefined\b|\b\w+:\s*undefined\b|undefinedundefined/ },
  { name: "null-binding", re: /\.null\b/ },
  { name: "NaN", re: /(^|\s)NaN(\s|$|\b)/ },
  { name: "object-Object", re: /\[object Object\]/ },
  { name: "i18n-namespace-key", re: new RegExp(`\\b(${NAMESPACES.join("|")}):[A-Za-z][A-Za-z0-9_.]*`) },
  { name: "enum-map-key", re: new RegExp(`\\b(${ENUM_MAPS.join("|")})\\.[A-Za-z]+`) },
];

/** Grab the visible text of the page body (what a user actually reads). */
export async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? "");
}

/** Assert no binding/i18n leaks anywhere in the visible page text. */
export async function expectNoLeaks(page: Page, label: string) {
  const text = await visibleText(page);
  for (const { name, re } of LEAK_PATTERNS) {
    const m = text.match(re);
    expect(m, `${label}: leak [${name}] -> "${m?.[0]}"`).toBeNull();
  }
}

/** Assert each category tile renders an inline icon (<svg data-icon>) and never a
 *  raw Ionicon name as text. (Turkish labels are non-ASCII, so we do NOT reject
 *  non-ASCII text — only the emoji-as-icon pattern and raw Ionicon names.) */
export async function expectCategoryTilesHaveInlineIcons(page: Page, label: string) {
  const tiles = page.locator('a[href^="/kategori/"]');
  const n = await tiles.count();
  expect(n, `${label}: no category tiles`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const svg = tiles.nth(i).locator("svg[data-icon]");
    expect(await svg.count(), `${label}: tile ${i} has no inline icon`).toBeGreaterThan(0);
  }
}

/** Assert no category tile renders a raw Ionicon name as its glyph. Scoped to
 *  the category-link tiles so English business names elsewhere can't false-trip. */
export async function expectNoRawIonicons(page: Page, label: string) {
  const tiles = page.locator('a[href^="/kategori/"]');
  const n = await tiles.count();
  for (let i = 0; i < n; i++) {
    const txt = (await tiles.nth(i).innerText()).trim();
    for (const name of IONICON_NAMES) {
      const re = new RegExp(`(^|\\n)${name.replace(/-/g, "\\-")}(\\n|$)`);
      expect(re.test(txt), `${label}: category tile shows raw Ionicon name "${name}"`).toBe(false);
    }
  }
}
