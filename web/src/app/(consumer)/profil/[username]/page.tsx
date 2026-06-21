"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormat } from "@/i18n/format";
import { useLanguage } from "@/i18n/useLanguage";
import type { UserProfile } from "@/lib/types";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { t } = useTranslation();
  const { formatDate } = useFormat();
  const { language, toggle: toggleLanguage } = useLanguage();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    async function load() {
      try {
        const user = await DatabaseService.getUserByUsername(username);
        if (!user) { setError(t("profile:error.userNotFound")); return; }
        const p = await DatabaseService.getUserProfile(user.id);
        setProfile(p);
      } catch {
        setError(t("profile:error.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, t]);

  if (loading) return <LoadingSpinner message={t("common:status.loading")} />;

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState title={error || t("profile:error.userNotFound")} icon="info" />
      </div>
    );
  }

  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-8 text-center">
        {/* Avatar */}
        <div className="w-20 h-20 mx-auto rounded-full bg-bilinc-primary/10 flex items-center justify-center mb-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-bilinc-primary">{initial}</span>
          )}
        </div>

        {/* Name & Username */}
        <h1 className="text-xl font-bold text-bilinc-text">
          {profile.display_name || profile.username}
        </h1>
        {profile.display_name && (
          <p className="text-sm text-bilinc-text-tertiary">@{profile.username}</p>
        )}

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <Badge variant="primary">{t("common:credibility." + profile.credibility_level, { defaultValue: profile.credibility_level })}</Badge>
          <Badge variant="default">{t("profile:stats.points", { count: profile.reputation_score })}</Badge>
        </div>

        {/* Member Since */}
        <p className="text-sm text-bilinc-text-tertiary mt-3">
          {t("profile:stats.memberSinceWeb", { date: formatDate(profile.member_since) })}
        </p>

        {/* Language switcher */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-sm text-bilinc-text-tertiary">{t("common:language.label")}</span>
          <button
            onClick={toggleLanguage}
            className="px-3 py-1 text-sm font-medium rounded-full border border-bilinc-primary text-bilinc-primary hover:bg-bilinc-primary/10 transition"
          >
            {language === "en" ? t("common:language.english") : t("common:language.turkish")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[
          { label: t("profile:stats.totalReviews"), value: profile.total_reviews },
          { label: t("profile:stats.totalFacts"), value: profile.total_facts },
          { label: t("profile:stats.verifiedFacts"), value: profile.verified_facts },
          { label: t("profile:stats.helpfulVotes"), value: profile.helpful_votes_received },
        ].map((stat) => (
          <div key={stat.label} className="bg-bilinc-surface border border-bilinc-border rounded-xl p-4 text-center">
            <span className="block text-2xl font-bold text-bilinc-text">{stat.value}</span>
            <span className="text-xs text-bilinc-text-tertiary">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
