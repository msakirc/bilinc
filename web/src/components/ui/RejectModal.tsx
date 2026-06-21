"use client";
import { useTranslation } from "react-i18next";
import { buttonClasses } from "@/components/ui/buttonVariants";

export function RejectModal({ title, reason, placeholder, onReasonChange, onCancel, onConfirm, submitting, testidPrefix = "admin-reject", confirmLabel }: {
  title: string; reason: string; placeholder?: string; onReasonChange: (v: string) => void; onCancel: () => void; onConfirm: () => void; submitting?: boolean; testidPrefix?: string; confirmLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" data-testid={`${testidPrefix}-modal`}>
      <div className="w-full max-w-md bg-bilinc-surface border border-bilinc-border rounded-2xl p-6">
        <h2 className="font-serif text-lg font-semibold text-bilinc-text mb-3">{title}</h2>
        <textarea
          value={reason}
          placeholder={placeholder}
          onChange={(e) => onReasonChange(e.target.value)}
          data-testid={`${testidPrefix}-reason`}
          className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 resize-none"
          rows={4}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onCancel} data-testid={`${testidPrefix}-cancel`} className={buttonClasses("outline", "md")}>{t("common:actions.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={submitting} data-testid={`${testidPrefix}-confirm`} className={buttonClasses("primary", "md")}>{confirmLabel ?? t("common:actions.submit")}</button>
        </div>
      </div>
    </div>
  );
}
