"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LEGAL_URLS } from "@/lib/legal";
import { Logo } from "@/components/ui/Logo";
import { Container } from "@/components/ui/Container";

const colLink =
  "text-sm text-bilinc-text-tertiary hover:text-bilinc-text transition";
const heading =
  "text-xs font-semibold uppercase tracking-wider text-bilinc-text-secondary mb-3";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-bilinc-border bg-bilinc-surface mt-auto">
      <Container>
        <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand + tagline */}
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm text-bilinc-text-tertiary max-w-[220px]">
              {t("common:app.tagline")}
            </p>
          </div>

          {/* Keşfet */}
          <nav aria-label={t("chrome:footer.exploreHeading")}>
            <h2 className={heading}>{t("chrome:footer.exploreHeading")}</h2>
            <ul className="space-y-2">
              <li><Link href="/" className={colLink}>{t("common:nav.home")}</Link></li>
              <li><Link href="/ara" className={colLink}>{t("common:nav.search")}</Link></li>
            </ul>
          </nav>

          {/* Bilinç (existing routes only — no about/contact pages exist yet) */}
          <nav aria-label={t("chrome:footer.companyHeading")}>
            <h2 className={heading}>{t("chrome:footer.companyHeading")}</h2>
            <ul className="space-y-2">
              <li><Link href="/panel" className={colLink}>{t("common:nav.businessPanel")}</Link></li>
              <li><Link href="/giris" className={colLink}>{t("common:nav.login")}</Link></li>
              <li><Link href="/kayit" className={colLink}>{t("common:nav.register")}</Link></li>
            </ul>
          </nav>

          {/* Yasal — real /yasal hrefs (test-safe) */}
          <nav aria-label={t("chrome:footer.legalHeading")}>
            <h2 className={heading}>{t("chrome:footer.legalHeading")}</h2>
            <ul className="space-y-2">
              <li><Link href={LEGAL_URLS.privacy} className={colLink}>{t("common:nav.privacy")}</Link></li>
              <li><Link href={LEGAL_URLS.terms} className={colLink}>{t("common:nav.terms")}</Link></li>
              <li><Link href={LEGAL_URLS.kvkk} className={colLink}>KVKK</Link></li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-bilinc-border py-6 text-sm text-bilinc-text-tertiary">
          &copy; {year} Bilinç. {t("chrome:footer.rightsReserved")}
        </div>
      </Container>
    </footer>
  );
}
