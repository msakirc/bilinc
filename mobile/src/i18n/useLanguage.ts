/** Convenience hook for reading/changing the active language. */
import { useTranslation } from 'react-i18next';
import { setLanguage, supportedLocales, type AppLocale } from './index';

export function useLanguage() {
  const { i18n } = useTranslation();
  return {
    language: i18n.language as AppLocale,
    supportedLocales,
    setLanguage,
    toggle: () => setLanguage(i18n.language === 'tr' ? 'en' : 'tr'),
  };
}
