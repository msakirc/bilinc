/** Shared i18n constants for the web app. */
import { supportedLocales, type AppLocale } from './resources.generated';

export const FALLBACK_LOCALE: AppLocale = 'tr';
export const LOCALE_COOKIE = 'bilinc.lang';

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (supportedLocales as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): AppLocale {
  if (isSupportedLocale(value)) return value;
  // accept region-tagged values like "tr-TR" / "en-GB"
  const base = value?.split('-')[0];
  return isSupportedLocale(base) ? base : FALLBACK_LOCALE;
}

export { supportedLocales };
export type { AppLocale };
