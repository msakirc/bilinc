"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { buttonClasses } from "@/components/ui/buttonVariants";

export function LoginForm() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signIn, loading } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signIn(username, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors:loginFailed"));
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-bilinc-text">
          {t("auth:login.submit")}
        </h1>
        <p className="mt-1 text-sm text-bilinc-text-tertiary">{t("auth:login.subtitleWeb")}</p>
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
              placeholder="********"
            />
          </div>
          {error && <p role="alert" className="text-sm text-bilinc-disputed">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={buttonClasses("primary", "lg") + " w-full"}
          >
            {loading ? t("auth:login.submitting") : t("auth:login.submit")}
          </button>
          <p className="text-center text-sm text-bilinc-text-tertiary">
            {t("auth:login.noAccountPrefix")}{" "}
            <Link href="/kayit" className="text-bilinc-primary font-medium hover:underline">
              {t("common:nav.register")}
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
