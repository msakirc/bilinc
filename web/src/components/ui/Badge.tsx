export type BadgeVariant = "default" | "verified" | "pending" | "disputed" | "info" | "primary" | "amber";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-bilinc-surface-secondary text-bilinc-text-secondary",
  verified: "bg-bilinc-verified/10 text-bilinc-verified",
  pending: "bg-bilinc-pending/10 text-bilinc-pending",
  disputed: "bg-bilinc-disputed/10 text-bilinc-disputed",
  info: "bg-bilinc-info/10 text-bilinc-info",
  primary: "bg-bilinc-primary-light text-bilinc-primary",
  amber: "bg-bilinc-amber-soft text-bilinc-amber",
};

export function badgeVariantClass(variant: string): string {
  return VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default;
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  const baseClasses = "inline-flex items-center rounded-md";
  const sizeClasses = size === "sm" ? "px-[9px] py-[3px] text-[11px] font-semibold" : "px-3 py-1 text-sm font-medium";
  return (
    <span className={`${baseClasses} ${sizeClasses} ${badgeVariantClass(variant)}`}>
      {children}
    </span>
  );
}
