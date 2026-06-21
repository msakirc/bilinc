"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation, Trans } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatCounter } from "@/components/ui/StatCounter";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FactCard } from "@/components/fact/FactCard";
import { AlertCard } from "@/components/fact/AlertCard";
import { CategoryTile } from "@/components/category/CategoryTile";
import { ListingCard } from "@/components/listing/ListingCard";
import { HOME_CATEGORIES, categoryName } from "@/lib/categories/homeCategories";
import { tallyFactCounts } from "@/lib/facts/factStats";
import type { Listing, Fact } from "@/lib/types";

function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44" />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();

  const [tagsisFacts, setTagsisFacts] = useState<Fact[]>([]);
  const [trending, setTrending] = useState<Listing[]>([]);
  const [verifiedFacts, setVerifiedFacts] = useState<Fact[]>([]);
  const [disputedFacts, setDisputedFacts] = useState<Fact[]>([]);
  const [tallies, setTallies] = useState<Record<string, { verify: number; dispute: number }>>({});
  const [factCounts, setFactCounts] = useState<Record<string, { verifiedCount: number; hasTagsis: boolean }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tf, tr, vf, disputed] = await Promise.all([
          DatabaseService.getTagsisFacts(6).catch(() => []),
          DatabaseService.getTrendingListings(12).catch(() => []),
          DatabaseService.getRecentVerifiedFacts(4).catch(() => []),
          DatabaseService.getDisputedFacts(4).catch(() => []),
        ]);
        // The catalog has no popularity/trending index yet, so rank the fetched
        // set by engagement (review count, then rating) as a "popular" proxy —
        // a meaningful signal, unlike raw recency. Top 6. (A real recency rail
        // needs user locality to be useful, so it's dropped from v1.)
        const popular = [...(tr as Listing[])]
          .sort(
            (a, b) =>
              (b.total_reviews ?? 0) - (a.total_reviews ?? 0) ||
              (b.average_rating ?? 0) - (a.average_rating ?? 0),
          )
          .slice(0, 6);
        setTagsisFacts(tf as Fact[]); setTrending(popular); setVerifiedFacts(vf as Fact[]);
        setDisputedFacts(disputed as Fact[]);

        const disputedIds = (disputed as Fact[]).map((f) => f.id);
        DatabaseService.getFactCheckTallies(disputedIds).then(setTallies).catch(() => {});

        const listingIds = popular.map((l) => l.id);
        DatabaseService.getListingsFactCounts(listingIds)
          .then((rows) => setFactCounts(tallyFactCounts(rows)))
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-bilinc-primary-light to-transparent py-20 md:py-28">
        <Container className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-bilinc-border bg-bilinc-surface px-3.5 py-1.5 text-xs font-semibold text-bilinc-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-bilinc-verified" />
            {t("home:hero.eyebrow")}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-serif font-semibold tracking-tight leading-[1.05] text-5xl md:text-6xl text-bilinc-text">
            <Trans
              i18nKey="home:hero.webTitle"
              components={{ em: <em className="italic text-bilinc-primary" /> }}
            />
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-bilinc-text-secondary">
            {t("home:hero.webSubtitle")}
          </p>
          <form
            action="/ara"
            method="get"
            className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-bilinc-border bg-bilinc-surface p-2 pl-5 shadow-[0_8px_30px_rgba(27,77,62,0.08)]"
          >
            <svg className="w-5 h-5 shrink-0 text-bilinc-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              name="q"
              type="search"
              placeholder={t("home:searchPlaceholder")}
              aria-label={t("home:searchPlaceholder")}
              className="flex-1 bg-transparent text-base text-bilinc-text outline-none placeholder:text-bilinc-text-tertiary"
            />
            <button type="submit" className="shrink-0 rounded-xl bg-bilinc-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90">
              {t("home:hero.searchCta")}
            </button>
          </form>
          <div className="mt-9 flex items-center justify-center gap-10">
            <StatCounter value="81" label={t("home:trust.cities")} />
            <StatCounter value={String(verifiedFacts.length)} label={t("home:trust.facts")} />
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12">
        {/* Tağşiş Warnings */}
        <section>
          <SectionHeading
            title={t("home:sections.tagsisWarnings")}
            tone="alert"
            moreHref="/ara"
            moreLabel={t("home:sections.tagsisThisWeek", { count: tagsisFacts.length })}
          />
          {loading ? (
            <CardGridSkeleton />
          ) : tagsisFacts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tagsisFacts.map((fact) => (
                <AlertCard key={fact.id} fact={fact} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("home:empty.tagsis")} icon="info" />
          )}
        </section>

        {/* Verified + Disputed band */}
        <section className="grid gap-8 md:grid-cols-2">
          {/* Verified */}
          <div>
            <SectionHeading title={t("home:sections.verifiedFacts")} tone="verified" />
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : verifiedFacts.length > 0 ? (
              <div className="space-y-4">
                {verifiedFacts.map((fact) => (
                  <FactCard key={fact.id} fact={fact} variant="verified" />
                ))}
              </div>
            ) : (
              <EmptyState title={t("home:empty.verified")} icon="star" />
            )}
          </div>
          {/* Disputed */}
          <div>
            <SectionHeading title={t("home:sections.disputedClaims")} tone="amber" />
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : disputedFacts.length > 0 ? (
              <div className="space-y-4">
                {disputedFacts.map((fact) => (
                  <FactCard
                    key={fact.id}
                    fact={fact}
                    variant="disputed"
                    tally={tallies[fact.id] ?? { verify: 0, dispute: 0 }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title={t("home:empty.disputed")} icon="info" />
            )}
          </div>
        </section>

        {/* Categories */}
        <section>
          <SectionHeading
            title={t("home:sections.categories")}
            moreHref="/ara"
            moreLabel={t("home:sections.viewAll")}
          />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {HOME_CATEGORIES.map((c) => (
              <CategoryTile
                key={c.slug}
                slug={c.slug}
                icon={c.icon}
                name={categoryName(c, i18n.language)}
              />
            ))}
          </div>
        </section>

        {/* Popular Businesses */}
        <section>
          <SectionHeading
            title={t("home:sections.popularBusinesses")}
            moreHref="/ara"
            moreLabel={t("home:sections.viewAll")}
          />
          {loading ? (
            <CardGridSkeleton />
          ) : trending.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  name={listing.name}
                  entity_type={listing.entity_type}
                  category_name={listing.category_name}
                  city_name={listing.city_name}
                  average_rating={listing.average_rating}
                  total_reviews={listing.total_reviews}
                  primary_photo_url={listing.primary_photo_url}
                  fact_count={factCounts[listing.id]?.verifiedCount}
                  has_tagsis={factCounts[listing.id]?.hasTagsis}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={t("home:empty.listings")} icon="list" />
          )}
        </section>

        {/* Join band */}
        <section className="flex flex-col gap-8 rounded-3xl bg-bilinc-brand p-10 text-white md:flex-row md:items-center md:justify-between md:gap-8 md:p-12">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
              {t("home:join.label")}
            </span>
            <h2 className="mt-2 max-w-md font-serif font-semibold text-3xl leading-tight tracking-tight">
              {t("home:join.title")}
            </h2>
            <p className="mt-3 max-w-md text-[15px] text-white/75">{t("home:join.body")}</p>
            <div className="mt-6 flex flex-wrap gap-8">
              <div>
                <div className="font-serif font-semibold text-2xl">+10</div>
                <div className="mt-0.5 text-[13px] text-white/70">{t("home:join.perReview")}</div>
              </div>
              <div>
                <div className="font-serif font-semibold text-2xl">+25</div>
                <div className="mt-0.5 text-[13px] text-white/70">{t("home:join.perFact")}</div>
              </div>
              <div>
                <div className="font-serif font-semibold text-2xl">100</div>
                <div className="mt-0.5 text-[13px] text-white/70">{t("home:join.threshold")}</div>
              </div>
            </div>
          </div>
          <Link
            href="/kayit"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-bilinc-amber px-7 py-4 text-[15px] font-semibold text-white transition hover:opacity-90 md:self-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("home:join.cta")}
          </Link>
        </section>
      </Container>
    </div>
  );
}
