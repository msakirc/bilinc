// Central selector strings, mirroring the canonical TR i18n (tr is the fallback
// locale, so text is stable). If a label changes in i18n/locales/tr/*.json,
// update it here too. Prefer role/placeholder over raw text where possible.

export const TR = {
  // auth:login.submit / common:nav.* / auth:register.*
  loginSubmit: "Giriş Yap", // button on /giris
  navLogin: "Giriş", // navbar link when logged out
  navRegister: "Kayıt Ol", // navbar link + /kayit button
  navLogout: "Çıkış Yap", // user dropdown
  // input placeholders
  usernamePlaceholder: "kullanici_adi",
  loginPasswordPlaceholder: "********",
  registerPasswordPlaceholder: "En az 6 karakter",
  registerConfirmPlaceholder: "Şifreyi tekrarlayın",
  searchPlaceholder: "İşletme, ürün veya marka ara...",
  // search filter pills (common:entityType.*)
  entityBrand: "Marka",
  // search empty states
  searchPromptTitle: "Aramak için bir şey yazın",
  // activity (tab buttons carry a "(N)" count suffix — match by prefix)
  activityReviewsTab: /Değerlendirmelerim/,
  activityFactsTab: /Bilgilerim/,
  // fact report
  factLowRepTitle: "Yetersiz İtibar Puanı",
  factCategoryPlaceholder: "Kategori seçin",
  factSubmit: "Bilgiyi Gönder",
  // review write
  reviewContentPlaceholder: "Deneyiminizi paylaşın (en az 10 karakter)",
  reviewSubmit: "Değerlendirmeyi Gönder",
  // not-found empty states
  businessNotFound: "İşletme bulunamadı",
  categoryNotFound: "Kategori bulunamadı",
  profileNotFound: "Kullanıcı bulunamadı",
  // business detail action links
  bizWriteReview: "Değerlendirme Yaz",
  bizAddFact: "Bilgi Ekle",
} as const;

// Admin panel (/yonetim) — page <h1> titles, from i18n/locales/tr/admin.json.
// Sections are reached by data-testid (admin-nav-*) so only titles live here.
export const ADMIN = {
  dashboardTitle: "Yönetim Paneli",
  usersTitle: "Kullanıcılar",
  listingsTitle: "İşletmeler",
  reviewsTitle: "Yorumlar",
  factsTitle: "Bilgiler",
  claimsTitle: "Talepler",
  editsTitle: "Düzenlemeler",
  // section route -> expected title, for the nav sweep
  sections: [
    { testid: "admin-nav-dashboard", url: "/yonetim", title: "Yönetim Paneli" },
    { testid: "admin-nav-users", url: "/yonetim/kullanicilar", title: "Kullanıcılar" },
    { testid: "admin-nav-listings", url: "/yonetim/isletmeler", title: "İşletmeler" },
    { testid: "admin-nav-reviews", url: "/yonetim/yorumlar", title: "Yorumlar" },
    { testid: "admin-nav-facts", url: "/yonetim/bilgiler", title: "Bilgiler" },
    { testid: "admin-nav-claims", url: "/yonetim/talepler", title: "Talepler" },
    { testid: "admin-nav-edits", url: "/yonetim/duzenlemeler", title: "Düzenlemeler" },
  ],
} as const;
