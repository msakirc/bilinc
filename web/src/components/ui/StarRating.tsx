"use client";

import { useTranslation } from "react-i18next";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, maxStars = 5, size = "md", interactive = false, onChange }: StarRatingProps) {
  const { t } = useTranslation();
  const sizeClasses = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-7 h-7" };
  const starSize = sizeClasses[size];

  return (
    <div
      className="flex items-center gap-0.5"
      role={interactive ? "group" : "img"}
      aria-label={interactive ? t("review:ratingGroupAria") : t("review:starAria", { n: Math.round(rating) })}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
            aria-label={interactive ? t("review:starAria", { n: i + 1 }) : undefined}
            aria-hidden={interactive ? undefined : true}
          >
            <svg
              className={`${starSize} ${filled ? "text-bilinc-star-filled" : "text-bilinc-star-empty"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
