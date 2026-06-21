'use client';

/**
 * Client i18n provider. The root (server) layout reads the locale cookie and
 * passes it as `initialLocale`, so server and client first-render with the same
 * language — no hydration mismatch. Language changes persist to cookie +
 * localStorage and are read back on the next request.
 */
import { useState, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from './createInstance';
import { LOCALE_COOKIE, resolveLocale, type AppLocale } from './config';

export function persistLocale(locale: AppLocale) {
  try {
    // 1 year, root path
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    // non-fatal (SSR / blocked storage)
  }
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: string;
  children: React.ReactNode;
}) {
  const locale = resolveLocale(initialLocale);
  const [instance] = useState(() => createI18n(locale));

  useEffect(() => {
    const onChange = (lng: string) => persistLocale(resolveLocale(lng));
    instance.on('languageChanged', onChange);
    return () => instance.off('languageChanged', onChange);
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
