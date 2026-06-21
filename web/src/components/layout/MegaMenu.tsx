"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useDismiss } from "@/hooks/useDismiss";

export function MegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 text-sm font-medium text-bilinc-text-secondary hover:text-bilinc-text transition"
      >
        {t("common:nav.categories")}
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-3 w-64 bg-bilinc-surface border border-bilinc-border rounded-xl shadow-lg p-2 z-50"
        >
          {/* TODO(Phase 3): replace with populated icon + name + count grid
              once the category read is moved off the empty Supabase table. */}
          <Link
            role="menuitem"
            href="/ara"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 text-sm font-medium text-bilinc-text rounded-lg hover:bg-bilinc-surface-secondary transition"
          >
            {t("common:nav.allCategories")}
          </Link>
        </div>
      )}
    </div>
  );
}
