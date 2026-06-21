"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { KVKK_CONSENT_TEXT, LEGAL_URLS } from "@/lib/legal";
import { buttonClasses } from "@/components/ui/buttonVariants";

export function RegisterForm() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  // KVKK acik riza — cross-border data transfer consent (must NOT be pre-checked).
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [error, setError] = useState("");
  const { signUp, loading } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError(t("validation:passwordsNoMatch")); return; }
    if (password.length < 6) { setError(t("validation:passwordMin")); return; }
    if (username.length < 3) { setError(t("auth:register.errors.usernameMin")); return; }
    if (!acceptTerms) { setError(t("validation:mustAcceptTerms")); return; }
    if (!acceptKvkk) { setError(t("validation:mustAcceptConsent")); return; }
    try {
      await signUp(username, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth:register.failedTitle"));
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-bilinc-text">
          {t("common:nav.register")}
        </h1>
        <p className="mt-1 text-sm text-bilinc-text-tertiary">{t("auth:register.subtitleWeb")}</p>
      </div>
      <div className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-bilinc-text mb-2">
              {t("common:labels.username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              placeholder="kullanici_adi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bilinc-text mb-2">
              {t("common:labels.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              placeholder={t("auth:register.passwordPlaceholderWeb")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bilinc-text mb-2">
              {t("auth:register.confirmPasswordLabel")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-bilinc-border bg-bilinc-input px-4 py-3 text-bilinc-text placeholder:text-bilinc-text-tertiary focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30"
              placeholder={t("auth:register.confirmPasswordPlaceholderWeb")}
            />
          </div>
          {/* Terms of Service + Privacy Policy acceptance */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-bilinc-border accent-bilinc-primary"
            />
            <span className="text-sm text-bilinc-text-secondary leading-relaxed">
              <Link href={LEGAL_URLS.terms} target="_blank" className="text-bilinc-primary hover:underline">
                {t("auth:register.termsLink")}
              </Link>
              {t("auth:register.termsConjunction")}
              <Link href={LEGAL_URLS.privacy} target="_blank" className="text-bilinc-primary hover:underline">
                {t("auth:register.privacyLink")}
              </Link>
              {t("auth:register.termsSuffix")}
            </span>
          </label>

          {/* KVKK acik riza — cross-border data transfer (separate, required) */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptKvkk}
              onChange={(e) => setAcceptKvkk(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-bilinc-border accent-bilinc-primary"
            />
            <span className="text-sm text-bilinc-text-secondary leading-relaxed">
              {KVKK_CONSENT_TEXT}{" "}
              {t("auth:register.kvkkLead")}
              <Link href={LEGAL_URLS.kvkk} target="_blank" className="text-bilinc-primary hover:underline">
                {t("auth:register.kvkkLink")}
              </Link>
              {t("auth:register.kvkkSuffix")}
            </span>
          </label>

          {error && <p role="alert" className="text-sm text-bilinc-disputed">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={buttonClasses("primary", "lg") + " w-full"}
          >
            {loading ? t("auth:register.submitting") : t("common:nav.register")}
          </button>
          <p className="text-center text-sm text-bilinc-text-tertiary">
            {t("auth:register.haveAccountPrefix")}{" "}
            <Link href="/giris" className="text-bilinc-primary font-medium hover:underline">
              {t("auth:login.submit")}
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
