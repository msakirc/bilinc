"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";

const PAGE_SIZE = 50;

const statusTabKeys = ["", "active", "pending", "removed"] as const;
type StatusTabKey = typeof statusTabKeys[number];

const statusOptions = ["active", "pending", "removed"] as const;

interface AdminListing {
  id: string;
  name: string;
  entity_type: string;
  status: string;
  city_code?: string;
  average_rating: number;
  total_reviews: number;
  created_at: string;
  created_by_user?: { username: string } | null;
}

export default function AdminListingsPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusTabKey>("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getAllListingsAdmin(PAGE_SIZE, page * PAGE_SIZE, statusFilter || undefined);
      setListings(data as AdminListing[]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleStatusChange = async (listingId: string, newStatus: string) => {
    try {
      await DatabaseService.updateListingStatus(listingId, newStatus);
      setListings((prev) => prev.map((l) => l.id === listingId ? { ...l, status: newStatus } : l));
    } catch (err) {
      console.error("Failed to update listing status:", err);
    }
  };

  const handleTabChange = (key: StatusTabKey) => {
    setStatusFilter(key);
    setPage(0);
  };

  const filterTabs = statusTabKeys.map((key) => ({
    key,
    label: key === "" ? t("admin:listings.tabs.all") : t("admin:listings.tabs." + key),
  }));

  return (
    <div>
      <PageHeader title={t("admin:listings.title")} />

      <FilterTabs
        tabs={filterTabs}
        value={statusFilter}
        onChange={handleTabChange}
        testid={(k) => `admin-filter-${k === "" ? "all" : k}`}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <DataTable
            testid="admin-listings-table"
            headers={[
              t("admin:listings.columns.name"),
              t("admin:listings.columns.type"),
              t("admin:listings.columns.status"),
              t("admin:listings.columns.city"),
              t("admin:listings.columns.rating"),
              t("admin:listings.columns.reviews"),
              t("admin:listings.columns.createdBy"),
              t("admin:listings.columns.date"),
            ]}
          >
            {listings.map((listing) => (
              <tr key={listing.id} data-testid={`admin-listing-row-${listing.id}`} className="hover:bg-bilinc-surface-secondary/50 transition">
                <td className="px-4 py-3 text-bilinc-text font-medium max-w-[200px] truncate">{listing.name}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{t("common:entityType." + listing.entity_type, { defaultValue: listing.entity_type })}</td>
                <td className="px-4 py-3">
                  <select
                    value={listing.status}
                    data-testid={`admin-listing-status-${listing.id}`}
                    onChange={(e) => handleStatusChange(listing.id, e.target.value)}
                    className="rounded-xl border border-bilinc-border bg-bilinc-input px-2 py-1 text-sm"
                  >
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>{t("admin:listings.status." + value)}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{listing.city_code || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text">{listing.average_rating?.toFixed(1) || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text">{listing.total_reviews}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{listing.created_by_user?.username || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(listing.created_at)}</td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={8} data-testid="admin-listings-empty">
                  <EmptyState icon="list" title={t("admin:listings.empty")} />
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
