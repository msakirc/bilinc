"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/useLanguage";
import { useAuthStore } from "@/store/auth";
import { useDismiss } from "@/hooks/useDismiss";
import { Logo } from "@/components/ui/Logo";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/buttonVariants";
import { ThemeToggle } from "./ThemeToggle";
import { MegaMenu } from "./MegaMenu";

const navLink =
  "text-sm font-medium text-bilinc-text-secondary hover:text-bilinc-text transition";

export function Navbar() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { user, initialized, initialize, signOut } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useDismiss(dropdownRef, dropdownOpen, () => setDropdownOpen(false));
  useDismiss(langRef, langOpen, () => setLangOpen(false));

  return (
    <header className="sticky top-0 z-40 bg-bilinc-surface/80 backdrop-blur-md border-b border-bilinc-border">
      <Container>
        <div className="flex items-center justify-between h-[68px] gap-7">
          <Logo />

          {/* Desktop nav — new IA */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className={navLink}>{t("common:nav.discover")}</Link>
            <MegaMenu />
            <Link href="/ara" className={navLink}>{t("common:nav.facts")}</Link>
          </nav>

          {/* Persistent inline search */}
          <form
            action="/ara"
            className="hidden lg:flex items-center gap-2 flex-1 max-w-[320px] bg-bilinc-surface border border-bilinc-border rounded-full px-4 py-2"
          >
            <svg className="w-4 h-4 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="search"
              name="q"
              placeholder={t("common:nav.searchPlaceholder")}
              aria-label={t("common:nav.search")}
              className="flex-1 bg-transparent text-sm text-bilinc-text outline-none placeholder:text-bilinc-text-tertiary"
            />
          </form>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            <Link
              href="/ara"
              className={`${buttonClasses("amber", "md")} hidden sm:inline-flex`}
            >
              {t("common:nav.reportFact")}
            </Link>

            <ThemeToggle />

            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                aria-label={t("common:language.label")}
                className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm font-medium text-bilinc-text-secondary hover:text-bilinc-text hover:bg-bilinc-surface-secondary transition"
              >
                {language === "tr" ? "TR" : "EN"}
                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {langOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-36 bg-bilinc-surface border border-bilinc-border rounded-xl shadow-lg p-1 z-50">
                  <button
                    role="menuitem"
                    onClick={() => { setLanguage("tr"); setLangOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-bilinc-text rounded-lg hover:bg-bilinc-surface-secondary transition"
                  >
                    {t("common:language.turkish")}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setLanguage("en"); setLangOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-bilinc-text rounded-lg hover:bg-bilinc-surface-secondary transition"
                  >
                    {t("common:language.english")}
                  </button>
                </div>
              )}
            </div>

            {initialized && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-label={t("common:nav.accountMenu")}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-bilinc-surface-secondary transition"
                >
                  <span className="w-7 h-7 rounded-full bg-bilinc-primary flex items-center justify-center text-white text-xs font-bold">
                    {user.username[0].toUpperCase()}
                  </span>
                  <span className="hidden sm:inline text-sm text-bilinc-text">{user.username}</span>
                </button>
                {dropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-52 bg-bilinc-surface border border-bilinc-border rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    <Link role="menuitem" href="/aktivite" onClick={() => setDropdownOpen(false)} className="block px-4 py-3 text-sm text-bilinc-text hover:bg-bilinc-surface-secondary transition">{t("common:nav.activity")}</Link>
                    {user.user_type === "business_owner" && (
                      <Link role="menuitem" href="/panel" onClick={() => setDropdownOpen(false)} className="block px-4 py-3 text-sm text-bilinc-text hover:bg-bilinc-surface-secondary transition">{t("common:nav.businessPanel")}</Link>
                    )}
                    {user.user_type === "admin" && (
                      <Link role="menuitem" href="/yonetim" onClick={() => setDropdownOpen(false)} className="block px-4 py-3 text-sm text-bilinc-text hover:bg-bilinc-surface-secondary transition">{t("common:nav.adminPanel")}</Link>
                    )}
                    <button
                      role="menuitem"
                      onClick={async () => { await signOut(); setDropdownOpen(false); router.push("/"); }}
                      className="w-full text-left px-4 py-3 text-sm text-bilinc-disputed hover:bg-bilinc-surface-secondary transition border-t border-bilinc-border"
                    >
                      {t("common:nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : initialized ? (
              <div className="flex items-center gap-1">
                <Link href="/giris" className={`${navLink} px-3 py-2`}>{t("common:nav.login")}</Link>
                <Link href="/kayit" className={buttonClasses("primary", "md")}>{t("common:nav.register")}</Link>
              </div>
            ) : null}

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t("common:nav.menu")}
              aria-expanded={menuOpen}
              className="md:hidden p-2 rounded-lg hover:bg-bilinc-surface-secondary"
            >
              <svg className="w-5 h-5 text-bilinc-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-bilinc-border py-3 space-y-1">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-bilinc-text-secondary hover:text-bilinc-text">{t("common:nav.discover")}</Link>
            <Link href="/ara" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-bilinc-text-secondary hover:text-bilinc-text">{t("common:nav.categories")}</Link>
            <Link href="/ara" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-bilinc-text-secondary hover:text-bilinc-text">{t("common:nav.facts")}</Link>
            <Link href="/ara" onClick={() => setMenuOpen(false)} className={`${buttonClasses("amber", "md")} mx-3 mt-1`}>{t("common:nav.reportFact")}</Link>
          </div>
        )}
      </Container>
    </header>
  );
}
