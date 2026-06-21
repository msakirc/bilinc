import { iconPathFor } from "./categoryIconPaths";

// Renders an inline line-icon. `data-icon` lets E2E assert the icon by name
// (replaces the old emoji-glyph assertion).
export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg
      data-icon={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={iconPathFor(icon)} />
    </svg>
  );
}
