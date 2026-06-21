import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';
import { useGuest } from '@/app/_layout';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { setGuest } = useGuest();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </View>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Bilinç</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t('auth:welcome.tagline')}</Text>
          </View>

          {/* Hero Image */}
          <View style={styles.heroContainer}>
            <Image
              source={{ uri: 'https://static.paraflowcontent.com/public/resource/image/f296427f-aa34-4662-b4ce-28bf6ba15617.jpeg' }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>

          {/* Value Propositions */}
          <View style={styles.valuesContainer}>
            {/* Review Anything */}
            <View style={[styles.valueCard, { backgroundColor: colors.surface }]}>
              <View style={styles.valueIconAmber}>
                <Ionicons name="globe-outline" size={24} color="#fff" />
              </View>
              <View style={styles.valueContent}>
                <Text style={[styles.valueTitle, { color: colors.text }]}>{t('auth:welcome.valueReviewTitle')}</Text>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {t('auth:welcome.valueReviewText')}
                </Text>
              </View>
            </View>

            {/* Separate Facts */}
            <View style={[styles.valueCard, { backgroundColor: colors.surface }]}>
              <View style={styles.valueIconSlate}>
                <Ionicons name="scale-outline" size={24} color="#fff" />
              </View>
              <View style={styles.valueContent}>
                <Text style={[styles.valueTitle, { color: colors.text }]}>{t('auth:welcome.valueFactsTitle')}</Text>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {t('auth:welcome.valueFactsText')}
                </Text>
              </View>
            </View>

            {/* Build Reputation */}
            <View style={[styles.valueCard, { backgroundColor: colors.surface }]}>
              <View style={styles.valueIconCoral}>
                <Ionicons name="trophy-outline" size={24} color="#fff" />
              </View>
              <View style={styles.valueContent}>
                <Text style={[styles.valueTitle, { color: colors.text }]}>{t('auth:welcome.valueReputationTitle')}</Text>
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {t('auth:welcome.valueReputationText')}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(auth)/onboarding')}
            >
              <Text style={styles.primaryButtonText}>{t('auth:welcome.getStarted')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{t('auth:welcome.haveAccount')}</Text>
            </TouchableOpacity>
          </View>

          {/* Guest Mode */}
          <View style={styles.guestSection}>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>{t('auth:welcome.or')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => { setGuest(true); router.replace('/(tabs)'); }}
            >
              <Text style={[styles.guestButtonText, { color: colors.primary }]}>{t('auth:welcome.browseAsGuest')}</Text>
            </TouchableOpacity>

            <Text style={[styles.guestDescription, { color: colors.textTertiary }]}>
              {t('auth:welcome.guestDescription')}
            </Text>
          </View>

          {/* Footer Links */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerLink}>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>{t('auth:welcome.privacyPolicy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerLink}>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>{t('auth:welcome.termsOfUse')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1B4D3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 28,
    color: 'white',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '400',
  },
  heroContainer: {
    marginBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: 256,
    borderRadius: 16,
  },
  valuesContainer: {
    marginBottom: 40,
  },
  valueCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  valueIconAmber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  valueIconSlate: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  valueIconCoral: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FB7185',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  iconText: {
    fontSize: 20,
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 16,
    color: '#4A4A4A',
    lineHeight: 24,
  },
  actionsContainer: {
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1B4D3E',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 24,
  },
  footerLink: {
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#757575',
  },
  guestSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#757575',
  },
  guestButton: {
    marginBottom: 12,
  },
  guestButtonText: {
    fontSize: 16,
    color: '#1B4D3E',
    fontWeight: '500',
  },
  guestDescription: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
