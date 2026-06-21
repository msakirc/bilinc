export type ButtonVariant = "primary" | "amber" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bilinc-primary/40 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-bilinc-primary text-white hover:opacity-90",
  amber: "bg-bilinc-amber text-white hover:opacity-90",
  outline: "border border-bilinc-border text-bilinc-text hover:bg-bilinc-surface-secondary",
  ghost: "text-bilinc-text-secondary hover:text-bilinc-text hover:bg-bilinc-surface-secondary",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}
