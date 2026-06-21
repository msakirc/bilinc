import Link from "next/link";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

interface CategoryTileProps { slug: string; name: string; icon: string; count?: number; countLabel?: string; }

export function CategoryTile({ slug, name, icon, count, countLabel }: CategoryTileProps) {
  return (
    <Link
      href={`/kategori/${slug}`}
      className="bg-bilinc-surface border border-bilinc-border rounded-xl py-[18px] px-3 text-center hover:border-bilinc-primary hover:shadow-sm transition group"
    >
      <span className="w-10 h-10 mx-auto mb-2.5 rounded-[10px] bg-bilinc-primary-light grid place-items-center">
        <CategoryIcon icon={icon} className="w-5 h-5 text-bilinc-primary" />
      </span>
      <span className="block text-sm font-semibold text-bilinc-text group-hover:text-bilinc-primary transition">{name}</span>
      {count != null && count > 0 && countLabel && (
        <span className="block text-xs text-bilinc-text-tertiary mt-1">{countLabel}</span>
      )}
    </Link>
  );
}
