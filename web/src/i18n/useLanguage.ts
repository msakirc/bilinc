'use client';

/** Read/change the active language on the web client. */
import { useTranslation } from 'react-i18next';
import { persistLocale } from './I18nProvider';
import { supportedLocales, resolveLocale, type AppLocale } from './config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const setLanguage = (locale: AppLocale) => {
    i18n.changeLanguage(locale);
    persistLocale(locale);
  };
  return {
    language: resolveLocale(i18n.language),
    supportedLocales,
    setLanguage,
    toggle: () => setLanguage(i18n.language === 'tr' ? 'en' : 'tr'),
  };
}
