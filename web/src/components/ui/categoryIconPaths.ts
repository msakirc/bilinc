// Inline line-icon path data (Lucide-style), keyed by the canonical category
// icon names from category-migrater.py. No runtime icon dependency — matches the
// codebase's inline-SVG idiom. Paths are simple line glyphs.
export const CATEGORY_ICON_PATHS: Record<string, string> = {
  utensils: "M6 3v6a2 2 0 004 0V3M8 11v10M16 3c-1.7 0-3 2.7-3 6 0 2.5.8 4.6 2 5.5V21", // food & beverage
  "heart-pulse": "M12 21s-7-5-9.5-9.5a5 5 0 019.5-2 5 5 0 019.5 2C19 16 12 21 12 21z", // health & beauty
  shirt: "M6 2l3 3 3-2 3 2 3-3 3 4-3 2v11H6V8L3 6z", // fashion
  home: "M3 11l9-8 9 8M5 10v10h14V10",             // home & living
  laptop: "M4 5h16v11H4zM2 19h20",                 // technology
  briefcase: "M3 8h18v12H3zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2", // services
  default: "M3 9l1-5h16l1 5M5 9v11h14V9M9 13h6",
};

export function iconPathFor(icon: string): string {
  return CATEGORY_ICON_PATHS[icon] ?? CATEGORY_ICON_PATHS.default;
}
