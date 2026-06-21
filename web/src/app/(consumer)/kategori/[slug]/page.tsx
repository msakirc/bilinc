"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CategoryTile } from "@/components/category/CategoryTile";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListingCard } from "@/components/listing/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Category, SearchResult } from "@/lib/types";

export default function CategoryPage() {
  const { t } = useTranslation();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const allCats = await DatabaseService.getCategories();
        const cat = allCats.find((c) => c.slug === slug) || null;
        setCategory(cat);

        if (cat) {
          const [subs, data] = await Promise.all([
            DatabaseService.getCategories(cat.id).catch(() => []),
            DatabaseService.browseCategory({ categorySlug: slug, limit: 48 }).catch(() => []),
          ]);
          setSubcategories(subs);
          setListings(data);
        }
      } catch {
        // Category not found or fetch error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <Container className="py-8">
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-bilinc-surface-secondary" />
        <div className="mb-8 h-10 w-64 animate-pulse rounded bg-bilinc-surface-secondary" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </Container>
    );
  }

  if (!category) {
    return (
      <Container className="py-16">
        <EmptyState title={t("category:empty.notFound")} icon="info" />
      </Container>
    );
  }

  return (
    <Container className="py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-bilinc-text-tertiary mb-6">
        <Link href="/" className="hover:text-bilinc-primary transition">
          {t("category:breadcrumb.home")}
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-bilinc-text font-medium">{category.name}</span>
      </nav>

      {/* Editorial header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CategoryIcon icon={category.icon || "default"} className="w-8 h-8 text-bilinc-primary" />
          <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-bilinc-text">
            {category.name}
          </h1>
        </div>
        <p className="mt-2 text-bilinc-text-secondary">{t("category:detail.description")}</p>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <section className="mb-10">
          <SectionHeading title={t("category:detail.subCategories")} />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {subcategories.map((sub) => (
              <CategoryTile
                key={sub.id}
                slug={sub.slug}
                name={sub.name}
                icon={sub.icon || "default"}
              />
            ))}
          </div>
        </section>
      )}

      {/* Listings */}
      <section>
        <SectionHeading title={t("category:resultsTitle")} />
        {listings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                id={l.id}
                name={l.name}
                entity_type={l.entity_type}
                category_name={l.category_name}
                city_name={l.city_name}
                average_rating={l.average_rating}
                total_reviews={l.total_reviews}
                primary_photo_url={l.primary_photo_url}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t("category:empty.noBusinesses")} icon="list" />
        )}
      </section>
    </Container>
  );
}
