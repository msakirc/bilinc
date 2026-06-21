"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";

interface ListingCardProps {
  id: string;
  name: string;
  entity_type: string;
  category_name?: string;
  city_name?: string;
  average_rating?: number;
  total_reviews?: number;
  primary_photo_url?: string;
  fact_count?: number;
  has_tagsis?: boolean;
}

export function ListingCard({ id, name, entity_type, category_name, city_name, average_rating, total_reviews, primary_photo_url, fact_count, has_tagsis }: ListingCardProps) {
  const { t } = useTranslation();
  return (
    <Link href={`/isletme/${id}`} className="block group">
      <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl overflow-hidden hover:shadow-md transition">
        {/* Photo */}
        <div className="aspect-[16/10] bg-bilinc-surface-secondary relative overflow-hidden">
          {primary_photo_url ? (
            <img src={primary_photo_url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-bilinc-text-tertiary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          {fact_count != null && fact_count > 0 && (
            <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md bg-bilinc-surface/95 backdrop-blur shadow-sm ${has_tagsis ? "text-bilinc-alert" : "text-bilinc-primary"}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                {has_tagsis
                  ? <path d="M12 9v4M12 17h.01M10.3 3.9L2.1 18a2 2 0 001.7 3h16.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                  : <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>}
              </svg>
              {has_tagsis ? t("home:listing.tagsisBadge", { count: fact_count }) : t("home:listing.factBadge", { count: fact_count })}
            </span>
          )}
        </div>
        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-bilinc-text group-hover:text-bilinc-primary transition line-clamp-1">{name}</h3>
            {entity_type && (
              <Badge variant="primary" size="sm">{t("common:entityType." + entity_type, { defaultValue: entity_type })}</Badge>
            )}
          </div>
          {(category_name || city_name) && (
            <p className="text-xs text-bilinc-text-tertiary mt-1">
              {category_name}
              {category_name && city_name && " · "}
              {city_name}
            </p>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <StarRating rating={average_rating || 0} size="sm" />
              <span className="text-sm font-medium text-bilinc-text">{(average_rating || 0).toFixed(1)}</span>
            </div>
            <span className="text-xs text-bilinc-text-tertiary">{t("business:reviewCount", { count: total_reviews || 0 })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
