"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { useAuthStore } from "@/store/auth";
import { isValidVKN } from "@/lib/vkn";
import { MobileHandoff } from "./MobileHandoff";
import type { ClaimRole } from "@/lib/types";

const ROLE_VALUES: ClaimRole[] = ["owner", "manager", "employee"];

export function ClaimForm({ listingId, listingName }: { listingId: string; listingName: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  const [role, setRole] = useState<ClaimRole>("owner");
  const [vkn, setVkn] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);

  const canSubmit = isValidVKN(vkn) && consent && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) { router.replace("/giris"); return; }
    if (!isValidVKN(vkn)) { setError(t("panel:claim.errors.invalidVkn")); return; }
    if (!consent) { setError(t("panel:claim.errors.consentRequired")); return; }

    setSubmitting(true);
    try {
      const id = await DatabaseService.createClaim({
        listingId,
        userId: user.id,
        role,
        verificationMethod: "video",
        taxNumber: vkn.trim(),
        consentAt: new Date().toISOString(),
      });
      setClaimId(id);
    } catch (err: unknown) {
      // 23505 = duplicate pending claim (unique partial index)
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("duplicate") || msg.includes("23505")
          ? t("panel:claim.errors.duplicate")
          : t("panel:claim.errors.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (claimId) {
    return <MobileHandoff claimId={claimId} />;
  }

  return (
    <form
      data-testid="claim-form"
      onSubmit={handleSubmit}
      className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 space-y-6"
    >
      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-bilinc-text mb-1">
          {t("panel:claim.roleLabel")}
        </label>
        <select
          data-testid="claim-role-select"
          value={role}
          onChange={(e) => setRole(e.target.value as ClaimRole)}
          className="w-full px-4 py-2.5 bg-bilinc-input text-bilinc-text rounded-xl border border-bilinc-border focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 focus:border-bilinc-primary"
        >
          {ROLE_VALUES.map((r) => (
            <option key={r} value={r}>{t("panel:claim.roles." + r)}</option>
          ))}
        </select>
      </div>

      {/* VKN */}
      <div>
        <label className="block text-sm font-medium text-bilinc-text mb-1">
          {t("panel:claim.vknLabel")}
        </label>
        <input
          data-testid="claim-vkn-input"
          value={vkn}
          onChange={(e) => setVkn(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder={t("panel:claim.vknPlaceholder")}
          className="w-full px-4 py-2.5 bg-bilinc-input text-bilinc-text rounded-xl border border-bilinc-border focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 focus:border-bilinc-primary"
        />
        <p className="text-xs text-bilinc-text-tertiary mt-1">
          {t("panel:claim.vknHelp")}
        </p>
      </div>

      {/* KVKK aydınlatma + rıza */}
      <div className="space-y-3">
        <p className="text-sm text-bilinc-text-secondary">
          {t("panel:claim.aydinlatmaLabel")}:{" "}
          <a
            href="/yasal/isletme-dogrulama"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bilinc-primary underline hover:opacity-80 transition"
          >
            {t("panel:claim.aydinlatmaLink")}
          </a>
        </p>
        <label
          data-testid="claim-consent-label"
          className="flex items-start gap-3 cursor-pointer"
        >
          <input
            data-testid="claim-consent-checkbox"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-bilinc-border text-bilinc-primary focus:ring-bilinc-primary/30"
          />
          <span className="text-sm text-bilinc-text">
            {t("panel:claim.consent")}
          </span>
        </label>
      </div>

      {error && (
        <p data-testid="claim-error" className="text-sm text-bilinc-disputed">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 bg-bilinc-surface border border-bilinc-border text-bilinc-text font-medium rounded-xl hover:bg-bilinc-surface-secondary transition"
        >
          {t("common:actions.cancel")}
        </button>
        <button
          data-testid="claim-submit-btn"
          type="submit"
          disabled={!canSubmit}
          className="flex-1 py-3 bg-bilinc-primary text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? t("panel:claim.submitting") : t("panel:claim.submit")}
        </button>
      </div>
    </form>
  );
}
