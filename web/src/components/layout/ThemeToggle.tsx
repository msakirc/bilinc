"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function getInitialDark(): boolean {
  // Guard for SSR: window/localStorage are undefined on the server. Default to
  // light there to avoid a hydration mismatch; the effect re-syncs the <html>
  // class on the client after mount.
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("bilinc_theme");
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const { t } = useTranslation();
  // Lazy initializer reads persisted preference once, without setState-in-effect.
  const [dark, setDark] = useState<boolean>(getInitialDark);

  useEffect(() => {
    // Keep the document class in sync with state (no setState here).
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function toggle() {
    const next = !dark;
    setDark(next); // effect applies the .dark class
    localStorage.setItem("bilinc_theme", next ? "dark" : "light");
  }

  return (
    <button onClick={toggle} className="p-2 rounded-lg hover:bg-bilinc-surface-secondary transition" title={dark ? t("chrome:theme.light") : t("chrome:theme.dark")}>
      {dark ? (
        <svg className="w-5 h-5 text-bilinc-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-bilinc-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
