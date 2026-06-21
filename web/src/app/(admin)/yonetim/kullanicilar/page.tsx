"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import type { User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";

const PAGE_SIZE = 50;

const userTypeValues = ["consumer", "business_owner", "admin"] as const;

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getAllUsers(PAGE_SIZE, page * PAGE_SIZE);
      setUsers(data as User[]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleTypeChange = async (userId: string, newType: string) => {
    try {
      await DatabaseService.updateUserType(userId, newType);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, user_type: newType as User["user_type"] } : u));
    } catch (err) {
      console.error("Failed to update user type:", err);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await DatabaseService.updateUserStatus(userId, !currentActive);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !currentActive } : u));
    } catch (err) {
      console.error("Failed to update user status:", err);
    }
  };

  const credibilityVariant = (level: string) => {
    if (level === "verified") return "verified" as const;
    if (level === "disputed") return "disputed" as const;
    return "default" as const;
  };

  return (
    <div>
      <PageHeader title={t("admin:users.title")} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <DataTable
            testid="admin-users-table"
            headers={[
              t("admin:users.columns.username"),
              t("admin:users.columns.displayName"),
              t("admin:users.columns.type"),
              t("admin:users.columns.reputation"),
              t("admin:users.columns.credibility"),
              t("admin:users.columns.active"),
              t("admin:users.columns.joinDate"),
            ]}
          >
            {users.map((user) => (
              <tr key={user.id} data-testid={`admin-user-row-${user.id}`} className="hover:bg-bilinc-surface-secondary/50 transition">
                <td className="px-4 py-3 text-bilinc-text font-medium">{user.username}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{user.display_name || "-"}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.user_type}
                    data-testid={`admin-user-type-${user.id}`}
                    onChange={(e) => handleTypeChange(user.id, e.target.value)}
                    className="rounded-xl border border-bilinc-border bg-bilinc-input px-2 py-1 text-sm"
                  >
                    {userTypeValues.map((value) => (
                      <option key={value} value={value}>{t("common:userType." + value, { defaultValue: value })}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-bilinc-text">{user.reputation_score}</td>
                <td className="px-4 py-3">
                  <Badge variant={credibilityVariant(user.credibility_level)}>
                    {t("common:credibility." + user.credibility_level, { defaultValue: user.credibility_level })}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button
                    data-testid={`admin-user-active-${user.id}`}
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    className={`relative w-10 h-5 rounded-full transition ${user.is_active ? "bg-bilinc-verified" : "bg-bilinc-border"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${user.is_active ? "left-5" : "left-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(user.created_at)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} data-testid="admin-users-empty">
                  <EmptyState icon="list" title={t("admin:users.empty")} />
                </td>
              </tr>
            )}
          </DataTable>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-bilinc-text-secondary">
              {t("admin:pagination.page", { page: page + 1 })}
            </p>
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
