import Link from "next/link";
import { pipToneClass, type PipTone } from "./sectionHeadingTone";

interface SectionHeadingProps {
  title: string;
  tone?: PipTone;
  moreHref?: string;
  moreLabel?: string;
}

export function SectionHeading({ title, tone, moreHref, moreLabel }: SectionHeadingProps) {
  const pip = pipToneClass(tone);
  return (
    <div className="flex items-baseline justify-between mb-5">
      <h2 className="font-serif font-semibold text-2xl tracking-tight flex items-center gap-2.5 text-bilinc-text">
        {pip && <span className={`w-2 h-2 rounded ${pip}`} />}
        {title}
      </h2>
      {moreHref && moreLabel && (
        <Link href={moreHref} className="text-sm font-semibold text-bilinc-primary hover:underline">
          {moreLabel}
        </Link>
      )}
    </div>
  );
}
