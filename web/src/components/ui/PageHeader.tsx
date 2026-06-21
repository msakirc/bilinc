import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-bilinc-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-bilinc-text-tertiary">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
