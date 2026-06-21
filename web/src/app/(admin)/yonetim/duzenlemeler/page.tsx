"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useFormat } from "@/i18n/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { RejectModal } from "@/components/ui/RejectModal";
import { buttonClasses } from "@/components/ui/buttonVariants";

const PAGE_SIZE = 50;

const KNOWN_FIELDS = [
  "name",
  "description",
  "address_line",
  "city_code",
  "entity_type",
  "category_id",
  "phone",
  "website",
];

interface AdminEdit {
  id: string;
  listing_id: string;
  user_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  status: string;
  created_at: string;
  user?: { username: string } | null;
  listing?: { name: string } | null;
}

export default function AdminEditsPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const fieldLabel = (field: string) =>
    KNOWN_FIELDS.includes(field) ? t("admin:edits.fields." + field) : field;
  const [edits, setEdits] = useState<AdminEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ editId: string; reason: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchEdits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getPendingEdits(PAGE_SIZE, page * PAGE_SIZE);
      setEdits(data as AdminEdit[]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch edits:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchEdits(); }, [fetchEdits]);

  const handleApprove = async (editId: string) => {
    setActionLoading(editId);
    try {
      await DatabaseService.updateEditStatus(editId, "approved");
      setEdits((prev) => prev.filter((e) => e.id !== editId));
    } catch (err) {
      console.error("Failed to approve edit:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.editId);
    try {
      await DatabaseService.updateEditStatus(rejectModal.editId, "rejected", rejectModal.reason || undefined);
      setEdits((prev) => prev.filter((e) => e.id !== rejectModal.editId));
      setRejectModal(null);
    } catch (err) {
      console.error("Failed to reject edit:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("admin:edits.title")} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <DataTable
            testid="admin-edits-table"
            headers={[
              t("admin:edits.columns.listing"),
              t("admin:edits.columns.user"),
              t("admin:edits.columns.field"),
              t("admin:edits.columns.oldValue"),
              t("admin:edits.columns.newValue"),
              t("admin:edits.columns.date"),
              t("admin:edits.columns.actions"),
            ]}
          >
            {edits.map((edit) => (
              <tr key={edit.id} data-testid={`admin-edit-row-${edit.id}`} className="hover:bg-bilinc-surface-secondary/50 transition-colors">
                <td className="px-4 py-3 text-bilinc-text font-medium max-w-[150px] truncate">{edit.listing?.name || "-"}</td>
                <td className="px-4 py-3 text-bilinc-text-secondary">{edit.user?.username || "-"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-bilinc-surface-secondary text-bilinc-text-secondary">
                    {fieldLabel(edit.field_name)}
                  </span>
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary max-w-[150px] truncate">
                  <span className="line-through text-bilinc-disputed/70">{edit.old_value || "-"}</span>
                </td>
                <td className="px-4 py-3 text-bilinc-text max-w-[150px] truncate">
                  <span className="text-bilinc-verified">{edit.new_value || "-"}</span>
                </td>
                <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(edit.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      data-testid={`admin-edit-approve-${edit.id}`}
                      onClick={() => handleApprove(edit.id)}
                      disabled={actionLoading === edit.id}
                      className={buttonClasses("primary", "sm")}
                    >
                      {t("admin:edits.approve")}
                    </button>
                    <button
                      data-testid={`admin-edit-reject-${edit.id}`}
                      onClick={() => setRejectModal({ editId: edit.id, reason: "" })}
                      disabled={actionLoading === edit.id}
                      className={buttonClasses("outline", "sm")}
                    >
                      {t("admin:edits.reject")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {edits.length === 0 && (
              <tr>
                <td colSpan={7} data-testid="admin-edits-empty" className="px-4 py-8 text-center text-bilinc-text-secondary">{t("admin:edits.empty")}</td>
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

      {rejectModal && (
        <RejectModal
          title={t("admin:edits.rejectModal.title")}
          placeholder={t("admin:edits.rejectModal.reasonPlaceholder")}
          reason={rejectModal.reason}
          onReasonChange={(v) => setRejectModal({ ...rejectModal, reason: v })}
          onCancel={() => setRejectModal(null)}
          onConfirm={handleReject}
          submitting={actionLoading !== null}
        />
      )}
    </div>
  );
}
