"use client";

import { useParams } from "next/navigation";
import { getLegalDoc } from "@/lib/legal";
import { EmptyState } from "@/components/ui/EmptyState";

export default function LegalDocPage() {
  const params = useParams<{ doc: string }>();
  const legalDoc = getLegalDoc(params.doc);

  if (!legalDoc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState title="Belge bulunamadı" icon="info" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-bilinc-text mb-6">{legalDoc.title}</h1>
      <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-bilinc-text-secondary">
          {legalDoc.body}
        </p>
      </div>
    </div>
  );
}
