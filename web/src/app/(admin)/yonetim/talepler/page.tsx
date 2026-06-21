"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useAuthStore } from "@/store/auth";
import { useFormat } from "@/i18n/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { RejectModal } from "@/components/ui/RejectModal";
import { buttonClasses } from "@/components/ui/buttonVariants";

const PAGE_SIZE = 50;

const KNOWN_ROLES = ["owner", "manager", "employee"];

type Tab = "pending" | "verified";

interface AdminClaim {
  id: string;
  listing_id: string;
  user_id: string;
  role: string;
  status: string;
  verification_method?: string;
  verification_document_url?: string;
  tax_number?: string;
  captured_lat?: number | null;
  captured_lng?: number | null;
  requested_at: string;
  verified_at?: string | null;
  user?: { username: string; user_type: string } | null;
  listing?: { name: string; slug: string; address_line?: string | null; city_code?: string | null } | null;
}

export default function AdminClaimsPage() {
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const { user } = useAuthStore();
  const roleLabel = (role: string) =>
    KNOWN_ROLES.includes(role) ? t("admin:claims.role." + role) : role;

  const [activeTab, setActiveTab] = useState<Tab>("pending");

  // --- Pending tab state ---
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ claimId: string; reason: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- Video player state ---
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>({});

  // --- Verified tab state ---
  const [verifiedClaims, setVerifiedClaims] = useState<AdminClaim[]>([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [verifiedPage, setVerifiedPage] = useState(0);
  const [verifiedHasMore, setVerifiedHasMore] = useState(true);
  const [revokeModal, setRevokeModal] = useState<{ claimId: string; reason: string } | null>(null);

  const viewDocument = async (path: string) => {
    try {
      const url = await DatabaseService.getSignedVerificationUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to sign document URL:", err);
    }
  };

  const handleWatchVideo = async (claimId: string, path: string) => {
    if (videoUrls[claimId]) return; // already loaded
    setVideoLoading((prev) => ({ ...prev, [claimId]: true }));
    try {
      const url = await DatabaseService.getSignedVerificationUrl(path);
      setVideoUrls((prev) => ({ ...prev, [claimId]: url }));
    } catch (err) {
      console.error("Failed to sign video URL:", err);
    } finally {
      setVideoLoading((prev) => ({ ...prev, [claimId]: false }));
    }
  };

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DatabaseService.getPendingClaims(PAGE_SIZE, page * PAGE_SIZE);
      setClaims(data as AdminClaim[]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchVerifiedClaims = useCallback(async () => {
    setVerifiedLoading(true);
    try {
      const data = await DatabaseService.getVerifiedClaims(PAGE_SIZE, verifiedPage * PAGE_SIZE);
      setVerifiedClaims(data as AdminClaim[]);
      setVerifiedHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch verified claims:", err);
    } finally {
      setVerifiedLoading(false);
    }
  }, [verifiedPage]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);
  useEffect(() => {
    if (activeTab === "verified") { fetchVerifiedClaims(); }
  }, [activeTab, fetchVerifiedClaims]);

  const handleApprove = async (claimId: string) => {
    if (!user) return;
    setActionLoading(claimId);
    try {
      await DatabaseService.updateClaimStatus(claimId, "verified", user.id);
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (err) {
      console.error("Failed to approve claim:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !user) return;
    setActionLoading(rejectModal.claimId);
    try {
      await DatabaseService.updateClaimStatus(rejectModal.claimId, "rejected", user.id, rejectModal.reason || undefined);
      setClaims((prev) => prev.filter((c) => c.id !== rejectModal.claimId));
      setRejectModal(null);
    } catch (err) {
      console.error("Failed to reject claim:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeModal || !user) return;
    setActionLoading(revokeModal.claimId);
    try {
      await DatabaseService.revokeClaim(revokeModal.claimId, user.id, revokeModal.reason || undefined);
      setVerifiedClaims((prev) => prev.filter((c) => c.id !== revokeModal.claimId));
      setRevokeModal(null);
    } catch (err) {
      console.error("Failed to revoke claim:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("admin:claims.title")} />

      {/* Tab bar */}
      <FilterTabs
        tabs={[
          { key: "pending", label: t("admin:claims.tabs.pending") },
          { key: "verified", label: t("admin:claims.tabs.verified") },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        testid={(k) => `admin-claims-tab-${k}`}
      />

      {/* ── PENDING TAB ── */}
      {activeTab === "pending" && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <DataTable
                testid="admin-claims-table"
                headers={[
                  t("admin:claims.columns.listing"),
                  t("admin:claims.columns.user"),
                  t("admin:claims.columns.role"),
                  t("admin:claims.columns.verificationMethod"),
                  t("admin:claims.columns.requestedAt"),
                  t("admin:claims.columns.actions"),
                ]}
              >
                {claims.map((claim) => (
                  <tr key={claim.id} data-testid={`admin-claim-row-${claim.id}`} className="hover:bg-bilinc-surface-secondary/50 transition-colors">
                    <td className="px-4 py-3 text-bilinc-text font-medium max-w-[200px] truncate">{claim.listing?.name || "-"}</td>
                    <td className="px-4 py-3 text-bilinc-text-secondary">{claim.user?.username || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{roleLabel(claim.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-bilinc-text-secondary">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span>{claim.verification_method || "-"}</span>
                          {claim.verification_document_url && claim.verification_method !== "video" && (
                            <button
                              data-testid={`admin-claim-doc-${claim.id}`}
                              onClick={() => viewDocument(claim.verification_document_url!)}
                              className="text-bilinc-primary hover:underline text-xs"
                            >
                              {t("admin:claims.document")}
                            </button>
                          )}
                          {claim.verification_document_url && claim.verification_method === "video" && (
                            <button
                              data-testid={`admin-claim-watch-${claim.id}`}
                              onClick={() => handleWatchVideo(claim.id, claim.verification_document_url!)}
                              disabled={videoLoading[claim.id]}
                              className="text-bilinc-primary hover:underline text-xs disabled:opacity-50"
                            >
                              {videoLoading[claim.id] ? "..." : t("admin:claims.watchVideo")}
                            </button>
                          )}
                        </div>
                        {videoUrls[claim.id] && (
                          <video
                            data-testid={`admin-claim-video-${claim.id}`}
                            src={videoUrls[claim.id]}
                            controls
                            className="w-full rounded mt-2"
                          />
                        )}
                        {claim.tax_number && (
                          <span className="text-xs text-bilinc-text-tertiary">{t("admin:claims.taxNumber", { value: claim.tax_number })}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(claim.requested_at)}</td>
                    <td className="px-4 py-3">
                      {/* Reconciliation block */}
                      <div className="mb-2 p-2 bg-bilinc-surface-secondary rounded-lg text-xs text-bilinc-text-secondary space-y-0.5">
                        <p className="font-medium text-bilinc-text mb-1">{t("admin:claims.reconciliation.title")}</p>
                        <p>
                          <span className="text-bilinc-text-tertiary">{t("admin:claims.reconciliation.taxNumber")}:</span>{" "}
                          <span data-testid="claim-tax-number">{claim.tax_number || "-"}</span>
                        </p>
                        <p>
                          <span className="text-bilinc-text-tertiary">{t("admin:claims.reconciliation.role")}:</span>{" "}
                          <span data-testid="claim-role">{roleLabel(claim.role)}</span>
                        </p>
                        <p>
                          <span data-testid="claim-listing-name" className="font-medium text-bilinc-text">{claim.listing?.name || "-"}</span>
                        </p>
                        <p data-testid="claim-listing-address">{claim.listing?.address_line || "-"}</p>
                        <p data-testid="claim-listing-city">{claim.listing?.city_code || "-"}</p>
                        {(claim.captured_lat != null || claim.captured_lng != null) && (
                          <p>
                            <span className="text-bilinc-text-tertiary">{t("admin:claims.reconciliation.gps")}:</span>{" "}
                            <span data-testid="claim-gps">{claim.captured_lat}, {claim.captured_lng}</span>
                          </p>
                        )}
                        {claim.captured_lat == null && claim.captured_lng == null && (
                          <p>
                            <span className="text-bilinc-text-tertiary">{t("admin:claims.reconciliation.gps")}:</span>{" "}
                            <span data-testid="claim-gps">-</span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          data-testid={`admin-claim-approve-${claim.id}`}
                          onClick={() => handleApprove(claim.id)}
                          disabled={actionLoading === claim.id}
                          className={buttonClasses("primary", "sm")}
                        >
                          {t("admin:claims.approve")}
                        </button>
                        <button
                          data-testid={`admin-claim-reject-${claim.id}`}
                          onClick={() => setRejectModal({ claimId: claim.id, reason: "" })}
                          disabled={actionLoading === claim.id}
                          className={buttonClasses("outline", "sm")}
                        >
                          {t("admin:claims.reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={6} data-testid="admin-claims-empty" className="px-4 py-8 text-center text-bilinc-text-secondary">{t("admin:claims.empty")}</td>
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
        </>
      )}

      {/* ── VERIFIED TAB ── */}
      {activeTab === "verified" && (
        <>
          {verifiedLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <DataTable
                testid="admin-verified-claims-table"
                headers={[
                  t("admin:claims.columns.listing"),
                  t("admin:claims.columns.user"),
                  t("admin:claims.columns.role"),
                  t("admin:claims.columns.requestedAt"),
                  t("admin:claims.columns.actions"),
                ]}
              >
                {verifiedClaims.map((claim) => (
                  <tr key={claim.id} data-testid={`admin-verified-claim-row-${claim.id}`} className="hover:bg-bilinc-surface-secondary/50 transition-colors">
                    <td className="px-4 py-3 text-bilinc-text font-medium max-w-[200px] truncate">{claim.listing?.name || "-"}</td>
                    <td className="px-4 py-3 text-bilinc-text-secondary">{claim.user?.username || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{roleLabel(claim.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-bilinc-text-secondary text-xs">{formatDate(claim.requested_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        data-testid={`admin-claim-revoke-${claim.id}`}
                        onClick={() => setRevokeModal({ claimId: claim.id, reason: "" })}
                        disabled={actionLoading === claim.id}
                        className={buttonClasses("outline", "sm")}
                      >
                        {t("admin:claims.revokeAction")}
                      </button>
                    </td>
                  </tr>
                ))}
                {verifiedClaims.length === 0 && (
                  <tr>
                    <td colSpan={5} data-testid="admin-verified-claims-empty" className="px-4 py-8 text-center text-bilinc-text-secondary">{t("admin:claims.verifiedEmpty")}</td>
                  </tr>
                )}
              </DataTable>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-bilinc-text-secondary">{t("admin:pagination.page", { page: verifiedPage + 1 })}</p>
                <div className="flex gap-2">
                  <button
                    data-testid="admin-verified-page-prev"
                    onClick={() => setVerifiedPage((p) => Math.max(0, p - 1))}
                    disabled={verifiedPage === 0}
                    className={buttonClasses("outline", "sm")}
                  >
                    {t("admin:pagination.previous")}
                  </button>
                  <button
                    data-testid="admin-verified-page-next"
                    onClick={() => setVerifiedPage((p) => p + 1)}
                    disabled={!verifiedHasMore}
                    className={buttonClasses("outline", "sm")}
                  >
                    {t("admin:pagination.next")}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Rejection modal */}
      {rejectModal && (
        <RejectModal
          title={t("admin:claims.rejectModal.title")}
          placeholder={t("admin:claims.rejectModal.reasonPlaceholder")}
          confirmLabel={t("admin:claims.reject")}
          reason={rejectModal.reason}
          onReasonChange={(v) => setRejectModal({ ...rejectModal, reason: v })}
          onCancel={() => setRejectModal(null)}
          onConfirm={handleReject}
          submitting={actionLoading !== null}
        />
      )}

      {/* Revoke modal */}
      {revokeModal && (
        <RejectModal
          testidPrefix="admin-revoke"
          title={t("admin:claims.revokeModal.title")}
          placeholder={t("admin:claims.revokeModal.reasonPlaceholder")}
          confirmLabel={t("admin:claims.revokeModal.confirm")}
          reason={revokeModal.reason}
          onReasonChange={(v) => setRevokeModal({ ...revokeModal, reason: v })}
          onCancel={() => setRevokeModal(null)}
          onConfirm={handleRevoke}
          submitting={actionLoading !== null}
        />
      )}
    </div>
  );
}
