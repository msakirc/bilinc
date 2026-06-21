/**
 * Mobile i18n runtime (i18next + react-i18next).
 *
 * Single instance, initialised synchronously with the device locale so the
 * first render is already localised. A stored user override (AsyncStorage) is
 * hydrated asynchronously via `hydrateLanguage()` — call it once at app boot.
 *
 * Translations come from the generated barrel (see i18n/sync.mjs). Edit strings
 * in repo-root i18n/locales/, never the copies under ./locales.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  resources,
  defaultNS,
  namespaces,
  supportedLocales,
  type AppLocale,
} from './resources.generated';

export const FALLBACK_LOCALE: AppLocale = 'tr';
const STORAGE_KEY = 'app.language';

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (supportedLocales as readonly string[]).includes(value);
}

function deviceLocale(): AppLocale {
  const code = Localization.getLocales()?.[0]?.languageCode ?? FALLBACK_LOCALE;
  return isSupportedLocale(code) ? code : FALLBACK_LOCALE;
}

i18n.use(initReactI18next).init({
  resources: resources as any,
  lng: deviceLocale(),
  fallbackLng: FALLBACK_LOCALE,
  defaultNS,
  ns: namespaces as unknown as string[],
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
  react: { useSuspense: false },
});

/** Read the persisted override (if any) and apply it. Call once at boot. */
export async function hydrateLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // non-fatal: keep device locale
  }
}

/** Switch language and persist the choice. */
export async function setLanguage(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // non-fatal
  }
}

export { supportedLocales };
export type { AppLocale };
export default i18n;
