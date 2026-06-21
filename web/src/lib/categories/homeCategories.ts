export interface HomeCategory {
  slug: string;     // real catalog slug == DynamoDB CAT#<slug>
  name: string;     // canonical Turkish label (category-migrater.py)
  name_en: string;
  icon: string;     // key into CATEGORY_ICON_PATHS
}

// Top-level grid on the home page. Six consumer-relevant L1 categories pulled
// verbatim from mobile/py/category-migrater.py. Counts omitted in v1.
export const HOME_CATEGORIES: HomeCategory[] = [
  { slug: "yiyecek-icecek",  name: "Yiyecek & İçecek",  name_en: "Food & Beverage", icon: "utensils" },
  { slug: "saglik-guzellik", name: "Sağlık & Güzellik",  name_en: "Health & Beauty", icon: "heart-pulse" },
  { slug: "moda",            name: "Moda",               name_en: "Fashion",         icon: "shirt" },
  { slug: "ev-yasam",        name: "Ev & Yaşam",         name_en: "Home & Living",   icon: "home" },
  { slug: "teknoloji",       name: "Teknoloji",          name_en: "Technology",      icon: "laptop" },
  { slug: "hizmetler",       name: "Hizmetler",          name_en: "Services",        icon: "briefcase" },
];

// Pick the label for the active language ("en" -> English, anything else -> Turkish canonical).
export function categoryName(c: HomeCategory, language: string): string {
  return language === "en" ? c.name_en : c.name;
}
