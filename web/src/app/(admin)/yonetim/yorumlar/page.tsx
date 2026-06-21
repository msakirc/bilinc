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

type FilterTab = "all" | "flagged" | "active" | "hidden" | "removed";

const filterTabKeys: FilterTab[] = ["all", "flagged", "active", "hidden", "removed"];

const statusOptions = ["active", "hidden", "removed"] as const;

interface AdminReview {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content: string;
  status: string;
  is_flagged: boolean;
  created_at: string;
  user?: { username: string } | null;
  listing?: { name: string } | null;
}

export default function AdminReviewsPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      let data: AdminReview[];
      if (filter === "flagged") {
        data = await DatabaseService.getFlaggedReviews(PAGE_SIZE, page * PAGE_SIZE) as AdminReview[];
      } else {
        data = await DatabaseService.getAllReviewsAdmin(PAGE_SIZE, page * PAGE_SIZE) as AdminReview[];
        if (filter !== "all") {
          data = data.filter((r) => r.status === filter);
        }
      }
      setReviews(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleStatusChange = async (reviewId: string, newStatus: string) => {
    try {
      await DatabaseService.updateReviewStatus(reviewId, newStatus);
      setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, status: newStatus, is_flagged: false } : r));
    } catch (err) {
      console.error("Failed to update review status:", err);
    }
  };

  const handleTabChange = (key: FilterTab) => {
    setFilter(key);
    setPage(0);
  };

  const filterTabs = filterTabKeys.map((key) => ({
    key,
    label: t("admin:reviews.tabs." + key),
  }));

  return (
    <div>
      <PageHeader title={t("admin:reviews.title")} />

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
            testid="admin-reviews-table"
            headers={[
              t("admin:reviews.columns.listing"),
              t("admin:reviews.columns.user"),
              t("admin:reviews.columns.rating"),
              t("admin:reviews.columns.content"),
              t("admin:reviews.columns.status"),
              t("admin:reviews.columns.flagged"),
              t("admin:reviews.columns.date"),
            ]}
          >
            {reviews.map((review) => (
              <tr key={review.id} data-testid={`admin-review-row-${review.id}`} className="hover:bg-bilinc-surface-secondary/50 transition">
                <td className="px-4 py-3 text-bilinc-text font-medium max-w-[150px] truncate">{review.listing?.name || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{review.user?.username || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text">{review.rating}/5</td>
                <td className="px-4 py-3 text-bilinc-text-secondary max-w-[250px] truncate">
                  {review.content.length > 100 ? review.content.slice(0, 100) + "..." : review.content}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={review.status}
                    data-testid={`admin-review-status-${review.id}`}
                    onChange={(e) => handleStatusChange(review.id, e.target.value)}
                    className="rounded-xl border border-bilinc-border bg-bilinc-input px-2 py-1 text-sm"
                  >
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>{t("admin:reviews.status." + value)}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {review.is_flagged ? (
                    <Badge variant="disputed">{t("admin:reviews.flagged.yes")}</Badge>
                  ) : (
                    <span className="text-xs text-bilinc-text-secondary">{t("admin:reviews.flagged.no")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(review.created_at)}</td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={7} data-testid="admin-reviews-empty">
                  <EmptyState icon="list" title={t("admin:reviews.empty")} />
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
