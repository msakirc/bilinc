import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import '@/src/i18n';
import { hydrateLanguage } from '@/src/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppDataProvider } from '@/src/contexts/AppDataContext';
import { useAuthStore } from '@/src/store/auth';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { initCrashReporting } from '@/src/services/crashReporting';

// Initialise crash reporting as early as possible (no-op unless
// EXPO_PUBLIC_SENTRY_DSN is set — see src/services/crashReporting.ts).
initCrashReporting();

// Guest mode context
const GuestContext = createContext<{
  isGuest: boolean;
  setGuest: (v: boolean) => void;
}>({ isGuest: false, setGuest: () => {} });

export const useGuest = () => useContext(GuestContext);

function AuthGate() {
  const { user, loading, refreshUser } = useAuthStore();
  const { isGuest } = useGuest();
  const segments = useSegments();
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    refreshUser().finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !isGuest && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isGuest, initialized, segments]);

  if (!initialized || loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>{t('common:status.loading')}</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerShown: false,
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text },
      contentStyle: { backgroundColor: colors.background },
    }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="business/[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="business/[id]/review" options={{ headerShown: true, title: t('review:screenTitle'), presentation: 'modal' }} />
      <Stack.Screen name="business/[id]/fact" options={{ headerShown: true, title: t('fact:screenTitle'), presentation: 'modal' }} />
      <Stack.Screen name="category/[slug]" options={{ headerShown: true, title: t('category:screenTitle') }} />
      <Stack.Screen name="category/[slug]/results" options={{ headerShown: true, title: t('category:resultsTitle') }} />
      <Stack.Screen name="settings/account" options={{ headerShown: true, title: t('settings:account.title') }} />
      <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: t('settings:notifications.title') }} />
      <Stack.Screen name="settings/privacy" options={{ headerShown: true, title: t('settings:privacy.title') }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    hydrateLanguage();
    AsyncStorage.getItem('bilinc_guest_mode').then(val => {
      if (val === 'true') setIsGuest(true);
    });
  }, []);

  const setGuest = (v: boolean) => {
    setIsGuest(v);
    AsyncStorage.setItem('bilinc_guest_mode', v ? 'true' : 'false');
  };

  return (
    <SafeAreaProvider>
      <GuestContext.Provider value={{ isGuest, setGuest }}>
        <ThemeProvider>
          <ErrorBoundary>
            <AppDataProvider>
              <AuthGate />
              <StatusBar style="auto" />
            </AppDataProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </GuestContext.Provider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap is a no-op passthrough when Sentry.init was never called
// (no DSN), so this is safe regardless of crash-reporting being enabled.
export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
  },
  loadingText: {
    fontSize: 24,
  },
});
