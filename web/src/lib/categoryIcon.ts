// Categories store an icon glyph. The migrated (staging) taxonomy stores an
// emoji directly (e.g. "🍽️"); the pre-migration PROD taxonomy stores an
// @expo/vector-icons *Ionicon name* (e.g. "restaurant"), which is meaningless on
// web and renders as raw text. This maps an Ionicon name to an emoji so the web
// category tiles render a glyph no matter which dataset the app is pointed at.
//
// If the stored value is already a non-ASCII glyph (emoji), it is returned as-is.

const IONICON_TO_EMOJI: Record<string, string> = {
  restaurant: "🍽️",
  "fast-food": "🍔",
  cafe: "☕",
  wine: "🍷",
  heart: "💆",
  medical: "🩺",
  fitness: "🏋️",
  barbell: "🏋️",
  shirt: "👕",
  cut: "✂️",
  home: "🏠",
  bed: "🏨",
  business: "💼",
  briefcase: "💼",
  build: "🔧",
  construct: "🔧",
  hammer: "🔨",
  "laptop-outline": "💻",
  laptop: "💻",
  "phone-portrait": "📱",
  car: "🚗",
  "car-sport": "🚗",
  bicycle: "🚲",
  school: "📚",
  book: "📚",
  library: "📚",
  ticket: "🎭",
  film: "🎬",
  "musical-notes": "🎵",
  paw: "🐾",
  basket: "🛍️",
  cart: "🛒",
  pricetag: "🏷️",
  storefront: "🏪",
  bag: "🛍️",
  airplane: "✈️",
  bus: "🚌",
  leaf: "🌿",
  paw_print: "🐾",
};

const FALLBACK = "🏷️";

export function categoryIcon(icon?: string | null): string {
  if (!icon) return FALLBACK;
  // Already an emoji / non-ASCII glyph → use as-is.
  if (!/^[\x00-\x7F]+$/.test(icon)) return icon;
  const key = icon.trim().toLowerCase();
  return IONICON_TO_EMOJI[key] ?? FALLBACK;
}
