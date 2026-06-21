"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Fact } from "@/lib/types";

export function AlertCard({ fact }: { fact: Fact }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl p-4 border border-bilinc-alert/30 border-l-4 border-l-bilinc-alert bg-bilinc-alert-soft">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-bilinc-alert">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9L2.1 18a2 2 0 001.7 3h16.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
        {t(`common:factCategory.${fact.category}`, { defaultValue: fact.category })}
      </span>
      <p className="text-sm font-semibold text-bilinc-text mt-2">{fact.statement}</p>
      {fact.listing?.name && (
        <Link href={`/isletme/${fact.listing_id}`} className="block text-sm text-bilinc-text-secondary mt-1 hover:underline">
          {fact.listing.name}
        </Link>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-bilinc-alert/80">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        {t("home:tagsis.officialData")}
      </div>
    </div>
  );
}
