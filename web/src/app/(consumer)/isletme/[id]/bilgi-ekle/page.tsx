"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DatabaseService } from "@/lib/database";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/buttonVariants";
import { useAuthStore } from "@/store/auth";
import { useTranslation } from "react-i18next";
import type { Listing, FactCategory } from "@/lib/types";

const FACT_CATEGORIES: FactCategory[] = [
  "safety", "health", "quality", "legal", "environmental", "abuse", "labor", "other",
];

export default function ReportFactPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, initialized, initialize } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [category, setCategory] = useState<string>("");
  const [statement, setStatement] = useState("");
  const [truthGuarantee, setTruthGuarantee] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/giris");
    }
  }, [initialized, user, router]);

  useEffect(() => {
    if (!id) return;
    DatabaseService.getListing(id)
      .then(setListing)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Match mobile's guard: a missing/undefined score must read as low-rep, not
  // bypass the gate (mobile uses `(reputation_score ?? 0) < 100`).
  const lowReputation = (user?.reputation_score ?? 0) < 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!category) { setError(t("fact:validation.selectCategory")); return; }
    if (statement.trim().length < 20) { setError(t("fact:validation.minLength")); return; }
    if (!truthGuarantee) { setError(t("fact:validation.guaranteeRequired")); return; }

    setSubmitting(true);
    try {
      await DatabaseService.submitFact({
        listingId: id,
        statement: statement.trim(),
        category,
        truthGuarantee: true,
      });
      router.push(`/isletme/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fact:error.genericWeb"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!initialized || loading) return <LoadingSpinner message={t("common:status.loading")} />;
  if (!user) return null;

  return (
    <Container>
      <div className="max-w-2xl mx-auto py-8 md:py-10">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-bilinc-text">
          {t("fact:title")}
        </h1>
        {listing && (
          <p className="mt-1 text-sm text-bilinc-text-tertiary">{listing.name}</p>
        )}

        {lowReputation ? (
          <div className="mt-6 bg-bilinc-pending-soft border border-bilinc-pending rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" className="w-6 h-6 text-bilinc-pending flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-medium text-bilinc-text mb-1">{t("fact:lowReputation.title")}</h3>
                <p className="text-sm text-bilinc-text-secondary">
                  {t("fact:lowReputation.message")}
                </p>
                <p className="text-sm text-bilinc-text-tertiary mt-2">
                  {t("fact:lowReputation.currentScore", { score: user.reputation_score })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 md:p-8 space-y-6">
            {/* Category */}
            <div>
              <label htmlFor="fact-category" className="block text-sm font-medium text-bilinc-text mb-2">{t("fact:category.labelRequired")}</label>
              <select
                id="fact-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              >
                <option value="">{t("fact:category.placeholder")}</option>
                {FACT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{t("common:factCategory." + cat, { defaultValue: cat })}</option>
                ))}
              </select>
            </div>

            {/* Statement */}
            <div>
              <label htmlFor="fact-statement" className="block text-sm font-medium text-bilinc-text mb-2">{t("fact:statement.labelWeb")} *</label>
              <textarea
                id="fact-statement"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 resize-none"
                placeholder={t("fact:statement.placeholderWeb")}
              />
              <p className="text-xs text-bilinc-text-tertiary mt-1">{t("fact:statement.charCount", { count: statement.length })}</p>
            </div>

            {/* Truth Guarantee */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={truthGuarantee}
                onChange={(e) => setTruthGuarantee(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-bilinc-border text-bilinc-primary focus:ring-bilinc-primary/30"
              />
              <span className="text-sm text-bilinc-text">
                {t("fact:truthGuarantee.labelWeb")}
              </span>
            </label>

            {error && <p role="alert" className="text-sm text-bilinc-disputed">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className={buttonClasses("outline", "md") + " flex-1"}
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={buttonClasses("amber", "lg") + " flex-1"}
              >
                {submitting ? t("fact:submitting") : t("fact:submitWeb")}
              </button>
            </div>
          </form>
        )}
      </div>
    </Container>
  );
}
