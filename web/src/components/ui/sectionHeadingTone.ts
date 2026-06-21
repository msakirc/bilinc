export type PipTone = "verified" | "disputed" | "alert" | "primary" | "amber";

// Static class strings (no interpolation) so Tailwind v4 JIT always emits them.
const TONE: Record<PipTone, string> = {
  verified: "bg-bilinc-verified",
  disputed: "bg-bilinc-disputed",
  alert: "bg-bilinc-alert",
  primary: "bg-bilinc-primary",
  amber: "bg-bilinc-amber",
};

export function pipToneClass(tone?: PipTone): string {
  return tone ? TONE[tone] : "";
}
