"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuthStore } from "@/store/auth";
import type { SearchSuggestion } from "@/lib/types";

export default function ClaimSearchPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, initialized, initialize } = useAuthStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => {
    if (initialized && !user) router.replace("/giris");
  }, [initialized, user, router]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(() => {
      DatabaseService.getSearchSuggestions(query.trim())
        .then((r) => { if (active) setResults(r); })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  if (!initialized) return <LoadingSpinner message={t("common:status.loading")} />;
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-bilinc-text mb-2">{t("panel:claim.searchTitle")}</h1>
      <p className="text-bilinc-text-secondary mb-8">
        {t("panel:claim.searchSubtitle")}
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("panel:claim.searchPlaceholder")}
        className="w-full px-4 py-3 bg-bilinc-input text-bilinc-text rounded-xl border border-bilinc-border focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 focus:border-bilinc-primary mb-4"
      />

      {searching && <p className="text-sm text-bilinc-text-tertiary">{t("panel:claim.searching")}</p>}

      <div className="space-y-2">
        {results.map((r) => (
          <Link
            key={r.id}
            href={`/sahiplen/${r.id}`}
            className="block bg-bilinc-surface border border-bilinc-border rounded-xl p-4 hover:bg-bilinc-surface-secondary transition"
          >
            <p className="font-medium text-bilinc-text">{r.name}</p>
            <p className="text-xs text-bilinc-text-tertiary">
              {[t("common:entityType." + r.entity_type, { defaultValue: r.entity_type }), r.category_name, r.city_name].filter(Boolean).join(" · ")}
            </p>
          </Link>
        ))}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="text-sm text-bilinc-text-secondary">{t("panel:claim.noResults")}</p>
        )}
      </div>
    </div>
  );
}
