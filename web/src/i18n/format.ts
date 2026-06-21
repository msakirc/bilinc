/**
 * Locale-aware formatting for web. `useFormat()` binds to the active language;
 * the bare functions take an explicit locale for server-side use.
 */
import { useTranslation } from 'react-i18next';
import type { AppLocale } from './config';

const LOCALE_TAG: Record<string, string> = { tr: 'tr-TR', en: 'en-US' };

export function localeTag(locale: string): string {
  return LOCALE_TAG[locale] ?? LOCALE_TAG.tr;
}

export function formatDate(
  locale: string,
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  return new Date(value).toLocaleDateString(localeTag(locale), opts);
}

export function formatNumber(
  locale: string,
  value: number,
  opts?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString(localeTag(locale), opts);
}

/** Hook returning formatters + relative-date helper bound to the active locale. */
export function useFormat() {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language;

  const formatRelativeDate = (value: string | number | Date): string => {
    const now = Date.now();
    const then = new Date(value).getTime();
    const diffMs = Math.max(0, now - then);
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (mins < 1) return t('date.justNow');
    if (mins < 60) return t('date.minutesAgo', { count: mins });
    if (hours < 24) return t('date.hoursAgo', { count: hours });
    if (days === 1) return t('date.yesterday');
    if (days < 7) return t('date.daysAgo', { count: days });
    return t('date.weeksAgo', { count: weeks });
  };

  return {
    locale: locale as AppLocale,
    formatDate: (v: string | number | Date, o?: Intl.DateTimeFormatOptions) => formatDate(locale, v, o),
    formatNumber: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(locale, v, o),
    formatRelativeDate,
  };
}
