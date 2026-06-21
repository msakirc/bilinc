/**
 * Locale-aware formatting helpers, driven by the active i18n language.
 * Use these instead of hardcoding `'tr-TR'` or inline relative-date strings.
 */
import i18n from './index';

const LOCALE_TAG: Record<string, string> = { tr: 'tr-TR', en: 'en-US' };

export function localeTag(): string {
  return LOCALE_TAG[i18n.language] ?? LOCALE_TAG.tr;
}

export function formatDate(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  return new Date(value).toLocaleDateString(localeTag(), opts);
}

export function formatMonthYear(value: string | number | Date): string {
  return formatDate(value, { year: 'numeric', month: 'long' });
}

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(localeTag(), opts);
}

/** Relative time using common.date.* keys. */
export function formatRelativeDate(value: string | number | Date): string {
  const t = i18n.getFixedT(null, 'common');
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
}
