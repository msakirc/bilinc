"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ClaimForm } from "@/components/claim/ClaimForm";
import { useAuthStore } from "@/store/auth";
import type { Listing } from "@/lib/types";

export default function ClaimListingPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, initialized, initialize } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => {
    if (initialized && !user) router.replace("/giris");
  }, [initialized, user, router]);

  useEffect(() => {
    if (!id) return;
    DatabaseService.getListing(id)
      .then(setListing)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (!initialized || loading) return <LoadingSpinner message={t("common:status.loading")} />;
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-bilinc-text mb-2">{t("panel:claim.requestTitle")}</h1>
      {listing && <p className="text-bilinc-text-secondary mb-8">{listing.name}</p>}
      {listing
        ? <ClaimForm listingId={id} listingName={listing.name} />
        : <p className="text-sm text-bilinc-disputed">{t("panel:claim.businessNotFound")}</p>}
    </div>
  );
}
