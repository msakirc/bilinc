"use client";

import { StarRating } from "@/components/ui/StarRating";
import { VoteButtons } from "@/components/listing/VoteButtons";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n/format";
import type { Review } from "@/lib/types";

interface ListingReviewsProps {
  reviews: Review[];
}

export function ListingReviews({ reviews }: ListingReviewsProps) {
  const { t } = useTranslation();
  const { formatRelativeDate } = useFormat();
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="flex flex-col bg-bilinc-surface border border-bilinc-border rounded-xl p-[18px]"
        >
          <div className="flex items-center gap-3 mb-2">
            <StarRating rating={review.rating} size="sm" />
            {review.title && (
              <span className="font-medium text-[15px] text-bilinc-text">{review.title}</span>
            )}
          </div>
          <p className="text-[15px] text-bilinc-text-secondary">{review.content}</p>
          <div className="mt-3 flex items-center justify-between gap-3 pt-[13px] border-t border-bilinc-border">
            <div className="flex items-center gap-2 text-[13px] text-bilinc-text-tertiary">
              {review.user && (
                <span className="font-medium text-bilinc-text-secondary">
                  {review.user.username}
                  <span className="ml-1 text-bilinc-text-tertiary">
                    · {t("common:credibility." + review.user.credibility_level, { defaultValue: review.user.credibility_level })}
                  </span>
                </span>
              )}
              <span>{formatRelativeDate(review.created_at)}</span>
            </div>
            <VoteButtons itemId={review.id} itemType="review" helpfulCount={review.helpful_count} />
          </div>
        </div>
      ))}
    </div>
  );
}
