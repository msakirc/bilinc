"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DatabaseService } from "@/lib/database";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/buttonVariants";
import { ListingFacts } from "@/components/listing/ListingFacts";
import { ListingReviews } from "@/components/listing/ListingReviews";
import { RatingDistribution } from "@/components/listing/RatingDistribution";
import { useTranslation } from "react-i18next";
import type { Listing, ListingStats, Fact, Review } from "@/lib/types";

export default function BusinessDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [stats, setStats] = useState<ListingStats | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [l, s, f, r] = await Promise.all([
          DatabaseService.getListing(id),
          DatabaseService.getListingStats(id).catch(() => null),
          DatabaseService.getListingFacts(id, 20).catch(() => []),
          DatabaseService.getListingReviews(id, 20).catch(() => []),
        ]);
        setListing(l); setStats(s); setFacts(f); setReviews(r);
      } catch {
        setError(t("business:notFound"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

  if (error || (!loading && !listing)) {
    return (
      <Container className="py-16">
        <EmptyState title={error || t("business:notFound")} icon="info" />
      </Container>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-bilinc-surface-secondary">
        {loading ? (
          <div className="h-64 md:h-80"><Skeleton className="h-full w-full rounded-none" /></div>
        ) : listing?.primary_photo_url ? (
          <div className="relative h-64 md:h-80 overflow-hidden">
            <img src={listing.primary_photo_url} alt={listing.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        ) : (
          <div className="flex h-48 md:h-60 items-center justify-center bg-gradient-to-br from-bilinc-primary-light to-transparent">
            <span className="font-serif text-7xl font-semibold text-bilinc-primary/40">
              {listing?.name?.charAt(0) ?? "?"}
            </span>
          </div>
        )}

        <Container>
          <div className={`relative z-10 rounded-2xl border border-bilinc-border bg-bilinc-surface p-6 md:p-8 ${loading || listing?.primary_photo_url ? "-mt-16 md:-mt-20" : "mt-6"}`}>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-9 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ) : listing ? (
              <>
                <div className="mb-3 flex flex-wrap items-start gap-2">
                  <Badge variant="primary">
                    {t("common:entityType." + listing.entity_type, { defaultValue: listing.entity_type })}
                  </Badge>
                  {listing.category_name && <Badge variant="info">{listing.category_name}</Badge>}
                  {listing.is_claimed && <Badge variant="verified">✓ {t("business:claimedBadge")}</Badge>}
                </div>
                <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-bilinc-text">
                  {listing.name}
                </h1>
                {(listing.city_name || listing.district_name) && (
                  <p className="mt-2 text-sm text-bilinc-text-tertiary">
                    {[listing.district_name, listing.city_name].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-bilinc-text-tertiary">{t("business:osmAttribution")}</p>
                {listing.description && (
                  <p className="mt-4 max-w-2xl text-[15px] text-bilinc-text-secondary">{listing.description}</p>
                )}
                <div className="mt-5 flex items-center gap-3">
                  <span className="font-serif text-4xl font-semibold text-bilinc-text">
                    {(listing.average_rating || 0).toFixed(1)}
                  </span>
                  <div>
                    <StarRating rating={listing.average_rating || 0} size="md" />
                    <span className="block text-xs text-bilinc-text-tertiary">
                      {t("business:reviewCount", { count: listing.total_reviews || 0 })}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </Container>
      </section>

      <Container className="space-y-12 py-10">
        {/* Contribute CTAs — amber = your turn to act */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/isletme/${id}/yorum-yaz`} className={buttonClasses("primary", "lg") + " flex-1 text-center"}>
            {t("business:actions.writeReview")}
          </Link>
          <Link href={`/isletme/${id}/bilgi-ekle`} className={buttonClasses("amber", "lg") + " flex-1 text-center"}>
            {t("business:actions.addFact")}
          </Link>
        </div>
        <Link href={`/sahiplen/${id}`} className="-mt-6 flex items-center justify-center gap-2 text-sm text-bilinc-primary hover:underline">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("business:actions.claimOwnership")}
        </Link>

        {/* Facts FIRST (product premise) */}
        <section>
          <SectionHeading
            title={`${t("business:sections.factsCount")}${stats ? ` (${stats.total_facts})` : ""}`}
            tone="verified"
          />
          {loading ? (
            <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          ) : facts.length > 0 ? (
            <ListingFacts facts={facts} />
          ) : (
            <EmptyState title={t("business:empty.noFacts")} subtitle={t("business:empty.noFactsSubtitle")} icon="info" />
          )}
        </section>

        {/* Rating distribution (only when reviews exist) */}
        {stats && stats.total_reviews > 0 && (
          <section>
            <SectionHeading title={t("business:sections.ratingDistribution")} tone="primary" />
            <RatingDistribution stats={stats} />
          </section>
        )}

        {/* Reviews */}
        <section>
          <SectionHeading
            title={`${t("business:sections.reviewsCount")}${stats ? ` (${stats.total_reviews})` : ""}`}
            tone="amber"
          />
          {loading ? (
            <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          ) : reviews.length > 0 ? (
            <ListingReviews reviews={reviews} />
          ) : (
            <EmptyState title={t("business:empty.noReviews")} subtitle={t("business:empty.noReviewsSubtitle")} icon="star" />
          )}
        </section>
      </Container>
    </div>
  );
}
