import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';
import { DatabaseService } from '@/src/services/database';
import { useAuthStore } from '@/src/store/auth';

const MAX_CHARS = 500;

export default function WriteReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaItems, setMediaItems] = useState<string[]>([]); // URIs
  const MAX_MEDIA = 5;

  const isSubmitDisabled = rating === 0 || reviewText.trim().length < 10 || submitting;

  const handleSubmit = async () => {
    if (!rating || reviewText.trim().length < 10) return;

    setSubmitting(true);
    try {
      const review = await DatabaseService.submitReview({
        listingId: id,
        rating,
        content: reviewText.trim(),
      });

      // Upload photos if any
      if (mediaItems.length > 0 && review?.id) {
        await DatabaseService.uploadReviewPhotos(review.id, mediaItems);
      }

      Alert.alert(t('review:success.title'), t('review:success.message'), [
        { text: t('common:actions.ok'), onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Submit review error:', error);
      // If the error is an auth issue, show appropriate message
      if (error.code === '42501' || error.message?.includes('policy')) {
        Alert.alert(t('errors:title'), t('review:error.auth'));
      } else {
        Alert.alert(t('errors:title'), t('review:error.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    Alert.alert(
      t('review:draftSaved.title'),
      t('review:draftSaved.message'),
      [{ text: t('common:actions.ok'), onPress: () => router.back() }]
    );
  };

  const activeStar = hoveredStar || rating;

  if (!user) {
    return (
      <View style={[styles.container, styles.centeredMessage, { backgroundColor: colors.background }]}>
        <Text style={[styles.guestTitle, { color: colors.text }]}>{t('review:guest.title')}</Text>
        <Text style={[styles.guestSubtitle, { color: colors.textTertiary ?? '#757575' }]}>
          {t('review:guest.subtitle')}
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
          testID="review-guest-back"
        >
          <Text style={styles.primaryButtonText}>{t('review:guest.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Star Rating Selector */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('review:ratingLabel')}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                testID={`review-star-${star}`}
              >
                <Ionicons
                  name={star <= activeStar ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= activeStar ? '#F59E0B' : '#D1D5DB'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 ? (
            <Text style={styles.starLabel}>{t('review:starLabels.' + rating)}</Text>
          ) : (
            <Text style={styles.starLabelPlaceholder}>{t('review:ratingPlaceholder')}</Text>
          )}
        </View>

        {/* Review Text Input */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('review:content.label')}</Text>
          <TextInput
            style={[styles.textInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
            placeholder={t('review:content.placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={MAX_CHARS}
            value={reviewText}
            onChangeText={setReviewText}
            textAlignVertical="top"
            testID="review-text"
          />
          <View style={styles.charCountRow}>
            <Text style={[
              styles.charCount,
              reviewText.length >= MAX_CHARS && styles.charCountLimit,
            ]}>
              {reviewText.length}/{MAX_CHARS}
            </Text>
          </View>
        </View>

        {/* Fotoğraf Ekle */}
        <View style={[styles.mediaSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.mediaSectionTitle, { color: colors.text }]}>{t('review:media.title')}</Text>
          <Text style={styles.mediaSectionSubtitle}>{t('review:media.subtitle', { max: MAX_MEDIA, count: mediaItems.length })}</Text>

          <View style={styles.mediaGrid}>
            {mediaItems.map((uri, index) => (
              <View key={index} style={styles.mediaItem}>
                <Image source={{ uri }} style={styles.mediaImage} />
                <TouchableOpacity
                  style={styles.mediaRemoveButton}
                  onPress={() => setMediaItems(prev => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {mediaItems.length < MAX_MEDIA && (
              <TouchableOpacity
                style={styles.addMediaButton}
                onPress={async () => {
                  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permission.granted) {
                    Alert.alert(t('review:media.permissionTitle'), t('review:media.permissionMessage'));
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.8,
                  });
                  if (!result.canceled && result.assets[0]?.uri) {
                    setMediaItems(prev => [...prev, result.assets[0].uri]);
                  }
                }}
              >
                <Ionicons name="camera" size={24} color="#757575" />
                <Text style={styles.addMediaText}>{t('review:media.add')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="information-circle-outline" size={16} color="#757575" />
          <Text style={styles.privacyText}>{t('review:privacyNotice')}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.primaryButton, isSubmitDisabled && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.8}
            testID="review-submit"
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? t('review:submitting') : t('review:submit')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            onPress={handleSaveDraft}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>{t('review:saveDraft')}</Text>
          </TouchableOpacity>
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
  centeredMessage: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 40,
  },
  starLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4D3E',
    textAlign: 'center',
  },
  starLabelPlaceholder: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
  },

  // Text Input
  textInput: {
    minHeight: 140,
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  charCountRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  charCount: {
    fontSize: 12,
    color: '#757575',
  },
  charCountLimit: {
    color: '#EF4444',
  },

  // Privacy Notice
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  privacyIcon: {
    fontSize: 14,
    color: '#757575',
  },
  privacyText: {
    fontSize: 13,
    color: '#757575',
    flex: 1,
  },

  // Media Upload
  mediaSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaSectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  mediaSectionSubtitle: { fontSize: 13, color: '#757575', marginBottom: 12 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaItem: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  mediaRemoveButton: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  mediaRemoveText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  addMediaButton: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addMediaIcon: { fontSize: 24, color: '#757575' },
  addMediaText: { fontSize: 11, color: '#757575', marginTop: 2 },

  // Action Buttons
  actionsSection: {
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1B4D3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B4D3E',
  },
  secondaryButtonText: {
    color: '#1B4D3E',
    fontSize: 16,
    fontWeight: '600',
  },
});
