"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchBar } from "@/components/ui/SearchBar";
import { ListingCard } from "@/components/listing/ListingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import type { City, SearchResult } from "@/lib/types";

// min-rating filter removed: searchListings ignores minRating server-side (dead filter)

const ITEMS_PER_PAGE = 20;

function SearchSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
    </div>
  );
}

function SearchContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialPage = Number(searchParams.get("sayfa")) || 1;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [entityType, setEntityType] = useState<string>("");
  const [cityCode, setCityCode] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    DatabaseService.getCities().then(setCities).catch(() => {});
  }, []);

  const doSearch = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const data = await DatabaseService.searchListings({
        query: q,
        entityType: entityType || undefined,
        cityCode: cityCode || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (p - 1) * ITEMS_PER_PAGE,
      });
      setResults(data);
      // Estimate: API returns no total COUNT; if a full page came back, assume at least one more.
      // Do NOT replace with a computed total — the backend doesn't return one.
      setTotalPages(data.length < ITEMS_PER_PAGE ? p : p + 1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, cityCode]);

  useEffect(() => {
    if (query.trim()) {
      doSearch(query, page);
    }
  }, [query, page, doSearch]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setPage(1);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.replace(`/ara?${params.toString()}`, { scroll: false });
  }, [router]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const entityTypes = [
    { value: "", label: t("search:filters.all") },
    { value: "business", label: t("common:entityType.business") },
    { value: "product", label: t("common:entityType.product") },
    { value: "brand", label: t("common:entityType.brand") },
  ];

  return (
    <Container className="py-8">
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          placeholder={t("search:placeholderWeb")}
          defaultValue={initialQuery}
          onSearch={handleSearch}
          size="lg"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters */}
        <div className="lg:w-64 flex-shrink-0">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            className="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-bilinc-surface border border-bilinc-border rounded-xl mb-4 text-sm font-medium text-bilinc-text"
          >
            {t("search:filters.title")}
            <svg className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div id="filter-panel" className={`space-y-6 ${filtersOpen ? "block" : "hidden lg:block"}`}>
            {/* Entity Type */}
            <div>
              <h3 className="text-sm font-medium text-bilinc-text mb-3">{t("search:filters.type")}</h3>
              <div className="flex flex-wrap gap-2">
                {entityTypes.map((et) => (
                  <button
                    key={et.value}
                    onClick={() => { setEntityType(et.value); setPage(1); }}
                    aria-pressed={entityType === et.value}
                    className={`px-3 py-1.5 text-sm rounded-full border transition ${
                      entityType === et.value
                        ? "bg-bilinc-primary text-white border-bilinc-primary"
                        : "bg-bilinc-surface text-bilinc-text-secondary border-bilinc-border hover:border-bilinc-primary"
                    }`}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <h3 className="text-sm font-medium text-bilinc-text mb-3">{t("search:filters.city")}</h3>
              <select
                id="city-filter"
                aria-label={t("search:filters.city")}
                value={cityCode}
                onChange={(e) => { setCityCode(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-bilinc-input text-bilinc-text text-sm rounded-xl border border-bilinc-border focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              >
                <option value="">{t("search:filters.allCities")}</option>
                {cities.map((city) => (
                  <option key={city.code} value={city.code}>{city.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          {loading ? (
            <SearchSkeleton />
          ) : results.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((r) => (
                  <ListingCard
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    entity_type={r.entity_type}
                    category_name={r.category_name}
                    city_name={r.city_name}
                    average_rating={r.average_rating}
                    total_reviews={r.total_reviews}
                    primary_photo_url={r.primary_photo_url}
                  />
                ))}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
            </>
          ) : query.trim() ? (
            <EmptyState title={t("common:empty.noResults")} subtitle={t("search:empty.noResultsSubtitleWeb")} icon="search" />
          ) : (
            <EmptyState title={t("search:empty.promptTitle")} subtitle={t("search:empty.promptSubtitle")} icon="search" />
          )}
        </div>
      </div>
    </Container>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-8"><Container><SearchSkeleton /></Container></div>}>
      <SearchContent />
    </Suspense>
  );
}
