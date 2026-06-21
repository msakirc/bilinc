"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";

const PAGE_SIZE = 50;

type FilterTab = "all" | "flagged" | "pending" | "verified" | "disputed";

const filterTabKeys: FilterTab[] = ["all", "flagged", "pending", "verified", "disputed"];

const verificationOptions = ["pending", "verified", "disputed", "retracted"] as const;

interface AdminFact {
  id: string;
  listing_id: string;
  user_id: string;
  statement: string;
  category: string;
  verification_status: string;
  is_flagged: boolean;
  created_at: string;
  user?: { username: string } | null;
  listing?: { name: string } | null;
}

export default function AdminFactsPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const [facts, setFacts] = useState<AdminFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchFacts = useCallback(async () => {
    setLoading(true);
    try {
      let data: AdminFact[];
      if (filter === "flagged") {
        data = await DatabaseService.getFlaggedFacts(PAGE_SIZE, page * PAGE_SIZE) as AdminFact[];
      } else {
        data = await DatabaseService.getAllFactsAdmin(PAGE_SIZE, page * PAGE_SIZE) as AdminFact[];
        if (filter !== "all") {
          data = data.filter((f) => f.verification_status === filter);
        }
      }
      setFacts(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch facts:", err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchFacts(); }, [fetchFacts]);

  const handleStatusChange = async (factId: string, newStatus: string) => {
    try {
      await DatabaseService.updateFactStatus(factId, newStatus);
      setFacts((prev) => prev.map((f) => f.id === factId ? { ...f, verification_status: newStatus, is_flagged: false } : f));
    } catch (err) {
      console.error("Failed to update fact status:", err);
    }
  };

  const handleTabChange = (key: FilterTab) => {
    setFilter(key);
    setPage(0);
  };

  const filterTabs = filterTabKeys.map((key) => ({
    key,
    label: t("admin:facts.tabs." + key),
  }));

  return (
    <div>
      <PageHeader title={t("admin:facts.title")} />

      <FilterTabs
        tabs={filterTabs}
        value={filter}
        onChange={handleTabChange}
        testid={(k) => `admin-filter-${k}`}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <DataTable
            testid="admin-facts-table"
            headers={[
              t("admin:facts.columns.listing"),
              t("admin:facts.columns.user"),
              t("admin:facts.columns.category"),
              t("admin:facts.columns.statement"),
              t("admin:facts.columns.verificationStatus"),
              t("admin:facts.columns.flagged"),
              t("admin:facts.columns.date"),
            ]}
          >
            {facts.map((fact) => (
              <tr key={fact.id} data-testid={`admin-fact-row-${fact.id}`} className="hover:bg-bilinc-surface-secondary/50 transition">
                <td className="px-4 py-3 text-bilinc-text font-medium max-w-[150px] truncate">{fact.listing?.name || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{fact.user?.username || "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant="default">
                    {t("common:factCategory." + fact.category, { defaultValue: fact.category })}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary max-w-[250px] truncate">
                  {fact.statement.length > 100 ? fact.statement.slice(0, 100) + "..." : fact.statement}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={fact.verification_status}
                    data-testid={`admin-fact-status-${fact.id}`}
                    onChange={(e) => handleStatusChange(fact.id, e.target.value)}
                    className="rounded-xl border border-bilinc-border bg-bilinc-input px-2 py-1 text-sm"
                  >
                    {verificationOptions.map((value) => (
                      <option key={value} value={value}>{t("admin:facts.verification." + value)}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {fact.is_flagged ? (
                    <Badge variant="disputed">{t("admin:facts.flagged.yes")}</Badge>
                  ) : (
                    <span className="text-xs text-bilinc-text-secondary">{t("admin:facts.flagged.no")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(fact.created_at)}</td>
              </tr>
            ))}
            {facts.length === 0 && (
              <tr>
                <td colSpan={7} data-testid="admin-facts-empty">
                  <EmptyState icon="list" title={t("admin:facts.empty")} />
                </td>
              </tr>
            )}
          </DataTable>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-bilinc-text-secondary">{t("admin:pagination.page", { page: page + 1 })}</p>
            <div className="flex gap-2">
              <button
                data-testid="admin-page-prev"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className={buttonClasses("outline", "sm")}
              >
                {t("admin:pagination.previous")}
              </button>
              <button
                data-testid="admin-page-next"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className={buttonClasses("outline", "sm")}
              >
                {t("admin:pagination.next")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
