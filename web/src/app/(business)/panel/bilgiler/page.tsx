"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import type { ListingClaim } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";

interface FactWithResponse {
  id: string;
  listing_id: string;
  statement: string;
  category: string;
  verification_status: string;
  created_at: string;
  user?: { username: string; credibility_level: string };
  response?: Array<{ id: string; content: string; created_at: string }>;
}

type FilterTab = "all" | "unanswered" | "answered" | "verified" | "disputed";

export default function FactsManagementPage() {
  const { t } = useTranslation();
  const { formatRelativeDate } = useFormat();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const listingParam = searchParams.get("listing");

  const [claims, setClaims] = useState<ListingClaim[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>(listingParam || "");
  const [facts, setFacts] = useState<FactWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadClaims() {
    try {
      const data = await DatabaseService.getClaimedListings(user!.id);
      setClaims(data);
      if (listingParam) {
        setSelectedListing(listingParam);
      } else if (data.length > 0 && data[0].listing) {
        setSelectedListing(data[0].listing.id);
      }
    } catch (err) {
      console.error("Load claims error:", err);
    }
  }

  const loadFacts = useCallback(async () => {
    if (!selectedListing) {
      setFacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await DatabaseService.getListingFactsForOwner(selectedListing);
      setFacts(data as FactWithResponse[]);
    } catch (err) {
      console.error("Load facts error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedListing]);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  async function handleSubmitResponse(factId: string) {
    if (!responseText.trim() || !selectedListing) return;
    setSubmitting(true);
    try {
      await DatabaseService.respondToFact({
        factId,
        listingId: selectedListing,
        content: responseText.trim(),
        userId: user!.id,
      });
      setRespondingTo(null);
      setResponseText("");
      await loadFacts();
    } catch (err) {
      console.error("Response submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredFacts = facts.filter((f) => {
    const hasResponse = f.response && f.response.length > 0;
    if (filter === "unanswered") return !hasResponse;
    if (filter === "answered") return hasResponse;
    if (filter === "verified") return f.verification_status === "verified";
    if (filter === "disputed") return f.verification_status === "disputed";
    return true;
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("panel:facts.filters.all") },
    { key: "unanswered", label: t("panel:facts.filters.unanswered") },
    { key: "answered", label: t("panel:facts.filters.answered") },
    { key: "verified", label: t("panel:facts.filters.verified") },
    { key: "disputed", label: t("panel:facts.filters.disputed") },
  ];

  function verificationBadgeVariant(status: string): "verified" | "disputed" | "pending" {
    if (status === "verified") return "verified";
    if (status === "disputed") return "disputed";
    return "pending";
  }

  return (
    <div>
      <PageHeader title={t("panel:facts.title")} />

      {/* Listing selector */}
      {claims.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedListing}
            onChange={(e) => setSelectedListing(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
          >
            {claims.map((claim) => (
              <option key={claim.id} value={claim.listing?.id || ""}>
                {claim.listing?.name || t("common:entityType.business")}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter tabs */}
      <FilterTabs
        tabs={filterTabs}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredFacts.length === 0 ? (
        <EmptyState
          icon="info"
          title={t("panel:facts.emptyTitle")}
          subtitle={
            filter === "unanswered"
              ? t("panel:facts.emptyUnanswered")
              : filter === "answered"
              ? t("panel:facts.emptyAnswered")
              : t("panel:facts.emptyAll")
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredFacts.map((fact) => {
            const hasResponse = fact.response && fact.response.length > 0;
            const isResponding = respondingTo === fact.id;

            return (
              <div key={fact.id} className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-5">
                {/* Fact header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bilinc-primary/10 flex items-center justify-center text-bilinc-primary text-sm font-bold">
                      {fact.user?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-bilinc-text">{fact.user?.username || t("panel:facts.anonymous")}</p>
                      <p className="text-xs text-bilinc-text-secondary">{formatRelativeDate(fact.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      {t("common:factCategory." + fact.category, { defaultValue: fact.category })}
                    </Badge>
                    <Badge variant={verificationBadgeVariant(fact.verification_status)}>
                      {t("common:verification." + fact.verification_status, { defaultValue: fact.verification_status })}
                    </Badge>
                  </div>
                </div>

                {/* Fact content */}
                <p className="text-sm text-bilinc-text mb-4">{fact.statement}</p>

                {/* Response section */}
                {hasResponse ? (
                  <div className="border-l-2 border-bilinc-primary bg-bilinc-surface-secondary rounded-lg p-4">
                    <p className="text-xs font-semibold text-bilinc-primary mb-1">{t("panel:facts.yourResponse")}</p>
                    <p className="text-sm text-bilinc-text">{fact.response![0].content}</p>
                    <p className="text-xs text-bilinc-text-secondary mt-2">{formatRelativeDate(fact.response![0].created_at)}</p>
                  </div>
                ) : isResponding ? (
                  <div className="bg-bilinc-surface-secondary rounded-xl p-4">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder={t("panel:facts.responsePlaceholder")}
                      rows={3}
                      className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => { setRespondingTo(null); setResponseText(""); }}
                        className={buttonClasses("outline", "sm")}
                      >
                        {t("common:actions.cancel")}
                      </button>
                      <button
                        onClick={() => handleSubmitResponse(fact.id)}
                        disabled={submitting || !responseText.trim()}
                        className={buttonClasses("primary", "sm")}
                      >
                        {submitting ? t("panel:facts.submitting") : t("common:actions.submit")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRespondingTo(fact.id); setResponseText(""); }}
                    className={buttonClasses("primary", "sm")}
                  >
                    {t("panel:facts.writeResponse")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
