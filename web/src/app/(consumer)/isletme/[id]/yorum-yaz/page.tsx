"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DatabaseService } from "@/lib/database";
import { StarRating } from "@/components/ui/StarRating";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/buttonVariants";
import { useAuthStore } from "@/store/auth";
import { useTranslation } from "react-i18next";
import type { Listing } from "@/lib/types";

export default function WriteReviewPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, initialized, initialize } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (rating === 0) { setError(t("review:validation.selectRating")); return; }
    if (content.trim().length < 10) { setError(t("review:validation.minLength")); return; }

    setSubmitting(true);
    try {
      await DatabaseService.submitReview({
        listingId: id,
        rating,
        title: title.trim() || undefined,
        content: content.trim(),
      });
      router.push(`/isletme/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("review:error.genericWeb"));
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
          {t("review:title")}
        </h1>
        {listing && (
          <p className="mt-1 text-sm text-bilinc-text-tertiary">{listing.name}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 md:p-8 space-y-6">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-bilinc-text mb-2">{t("review:ratingLabelWeb")}</label>
            <StarRating rating={rating} size="lg" interactive onChange={setRating} />
            {rating > 0 && <span className="text-sm text-bilinc-text-tertiary ml-2">{rating}/5</span>}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="review-title" className="block text-sm font-medium text-bilinc-text mb-2">{t("review:titleField.label")}</label>
            <input
              id="review-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              placeholder={t("review:titleField.placeholder")}
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="review-content" className="block text-sm font-medium text-bilinc-text mb-2">{t("review:content.labelWeb")}</label>
            <textarea
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 resize-none"
              placeholder={t("review:content.placeholderWeb")}
            />
            <p className="text-xs text-bilinc-text-tertiary mt-1">{t("review:content.charCount", { count: content.length })}</p>
          </div>

          {error && <p role="alert" className="text-sm text-bilinc-disputed">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className={buttonClasses("outline", "md")}
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={buttonClasses("primary", "lg") + " flex-1"}
            >
              {submitting ? t("review:submitting") : t("review:submitWeb")}
            </button>
          </div>
        </form>
      </div>
    </Container>
  );
}
