"use client";

import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  icon?: "search" | "list" | "star" | "info";
}

const icons = {
  search: (
    <svg className="w-12 h-12 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  list: (
    <svg className="w-12 h-12 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  star: (
    <svg className="w-12 h-12 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  info: (
    <svg className="w-12 h-12 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function EmptyState({ title, subtitle, icon = "list" }: EmptyStateProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icons[icon]}
      <h3 className="mt-4 text-lg font-medium text-bilinc-text">{title ?? t("empty.noResults")}</h3>
      {subtitle && <p className="mt-1 text-sm text-bilinc-text-tertiary">{subtitle}</p>}
    </div>
  );
}
