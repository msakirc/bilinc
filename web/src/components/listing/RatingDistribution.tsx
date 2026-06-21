import type { ListingStats } from "@/lib/types";

interface RatingDistributionProps {
  stats: ListingStats;
}

export function RatingDistribution({ stats }: RatingDistributionProps) {
  const total = stats.total_reviews || 1;
  const ratings = [
    { stars: 5, count: stats.rating_5 },
    { stars: 4, count: stats.rating_4 },
    { stars: 3, count: stats.rating_3 },
    { stars: 2, count: stats.rating_2 },
    { stars: 1, count: stats.rating_1 },
  ];

  return (
    <div className="space-y-2.5">
      {ratings.map(({ stars, count }) => (
        <div key={stars} className="flex items-center gap-2 text-sm">
          <span className="w-3 text-bilinc-text-secondary">{stars}</span>
          <svg className="w-4 h-4 text-bilinc-star-filled" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <div className="flex-1 h-2 bg-bilinc-surface-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-bilinc-star-filled rounded-full transition-all"
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-bilinc-text-tertiary">{count}</span>
        </div>
      ))}
    </div>
  );
}
