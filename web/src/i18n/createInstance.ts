/** Build a fresh i18next instance bound to react-i18next for a given locale. */
import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  resources,
  defaultNS,
  namespaces,
} from './resources.generated';
import { FALLBACK_LOCALE, type AppLocale } from './config';

export function createI18n(locale: AppLocale): I18nInstance {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources: resources as any,
    lng: locale,
    fallbackLng: FALLBACK_LOCALE,
    defaultNS,
    ns: namespaces as unknown as string[],
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
    react: { useSuspense: false },
  });
  return instance;
}
