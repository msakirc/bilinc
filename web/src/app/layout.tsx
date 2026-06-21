import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { fraunces, inter } from "./fonts";

export const metadata: Metadata = {
  title: "Bilinç - Gerçekleri Keşfet",
  description: "Türkiye'nin evrensel inceleme ve doğrulama platformu",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-bilinc-bg text-bilinc-text antialiased">
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
