"use client";

import { useTranslation } from "react-i18next";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ message, size = "md" }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const text = message ?? t("common:status.loading");
  const sizeClasses = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-bilinc-border border-t-bilinc-primary`} />
      {text && <p className="mt-3 text-sm text-bilinc-text-tertiary">{text}</p>}
    </div>
  );
}
