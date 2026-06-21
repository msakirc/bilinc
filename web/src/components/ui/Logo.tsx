import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const tile = size === "sm" ? "w-7 h-7 text-sm" : "w-8 h-8 text-base";
  const word = size === "sm" ? "text-lg" : "text-xl";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className={`${tile} rounded-lg bg-bilinc-primary text-white grid place-items-center font-serif font-bold`}>
        B
      </span>
      <span className={`${word} font-serif font-semibold text-bilinc-text tracking-tight`}>Bilinç</span>
    </Link>
  );
}
