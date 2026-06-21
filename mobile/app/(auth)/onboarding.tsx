import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: t('auth:onboarding.slide1Title'),
      subtitle: t('auth:onboarding.slide1Subtitle'),
      description: t('auth:onboarding.slide1Description'),
      image: 'https://static.paraflowcontent.com/public/resource/image/f296427f-aa34-4662-b4ce-28bf6ba15617.jpeg',
      icon: '🌐',
    },
    {
      title: t('auth:onboarding.slide2Title'),
      subtitle: t('auth:onboarding.slide2Subtitle'),
      description: t('auth:onboarding.slide2Description'),
      image: 'https://static.paraflowcontent.com/public/resource/image/f296427f-aa34-4662-b4ce-28bf6ba15617.jpeg',
      icon: '⚖️',
      factCard: true,
    },
    {
      title: t('auth:onboarding.slide3Title'),
      subtitle: t('auth:onboarding.slide3Subtitle'),
      description: t('auth:onboarding.slide3Description'),
      image: 'https://static.paraflowcontent.com/public/resource/image/f296427f-aa34-4662-b4ce-28bf6ba15617.jpeg',
      icon: '🏆',
      score: t('auth:onboarding.scoreExample'),
    },
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.push('/(auth)/register');
    }
  };

  const skipOnboarding = () => {
    router.push('/(auth)/register');
  };

  const slide = slides[currentSlide];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.skipButton} onPress={skipOnboarding}>
            <Text style={[styles.skipText, { color: colors.primary }]}>{t('auth:onboarding.skip')}</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  { backgroundColor: colors.textQuaternary ?? '#E0E7FF' },
                  index === currentSlide && { backgroundColor: colors.primary },
                ]}
              />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.slideContent}>
            <Text style={[styles.slideTitle, { color: colors.text }]}>{slide.title}</Text>
            <Text style={[styles.slideSubtitle, { color: colors.textSecondary }]}>{slide.subtitle}</Text>

            <View style={styles.imageContainer}>
              <Image source={{ uri: slide.image }} style={styles.slideImage} resizeMode="cover" />
            </View>

            <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>{slide.description}</Text>

            {slide.factCard && (
              <View style={styles.factCard}>
                <View style={styles.factBadge}>
                  <Text style={styles.factBadgeText}>{t('auth:onboarding.factBadge')}</Text>
                </View>
                <Text style={[styles.factText, { color: colors.text }]}>
                  {t('auth:onboarding.factExample')}
                </Text>
                <View style={styles.factVerification}>
                  <Text style={styles.verificationText}>{'✓ ' + t('auth:onboarding.factVerified')}</Text>
                </View>
              </View>
            )}

            {slide.score && (
              <View style={[styles.scoreCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.scoreText, { color: colors.text }]}>{slide.score}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
            <Text style={styles.nextButtonText}>
              {currentSlide === slides.length - 1 ? t('auth:onboarding.getStarted') : t('auth:onboarding.next')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#1B4D3E',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E7FF',
  },
  progressDotActive: {
    backgroundColor: '#64748B',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  slideContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  slideSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 32,
  },
  imageContainer: {
    width: '100%',
    marginBottom: 32,
  },
  slideImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#4A4A4A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  factCard: {
    backgroundColor: '#FFF4E6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  factBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  factBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  factText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 12,
  },
  factVerification: {
    alignItems: 'flex-end',
  },
  verificationText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  scoreCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  nextButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
