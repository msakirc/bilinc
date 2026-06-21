import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';
import { DatabaseService } from '@/src/services/database';
import { useAuthStore } from '@/src/store/auth';

const MAX_CHARS = 300;

const CATEGORIES: { key: string; ionicon: string }[] = [
  { key: 'safety', ionicon: 'nutrition-outline' },
  { key: 'health', ionicon: 'heart-outline' },
  { key: 'quality', ionicon: 'pricetag-outline' },
  { key: 'legal', ionicon: 'scale-outline' },
  { key: 'environmental', ionicon: 'leaf-outline' },
  { key: 'abuse', ionicon: 'hand-left-outline' },
  { key: 'labor', ionicon: 'people-outline' },
  { key: 'other', ionicon: 'document-text-outline' },
];

export default function ReportFactScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { user } = useAuthStore();

  const [factStatement, setFactStatement] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [truthGuarantee, setTruthGuarantee] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isSubmitDisabled =
    !user ||
    (user.reputation_score ?? 0) < 100 ||
    !truthGuarantee ||
    factStatement.trim().length < 20 ||
    selectedCategories.length === 0 ||
    submitting;

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (factStatement.trim().length < 20 || !truthGuarantee || selectedCategories.length === 0) return;

    setSubmitting(true);
    try {
      await DatabaseService.submitFact({
        listingId: id,
        statement: factStatement.trim(),
        category: selectedCategories[0], // Primary category
        truthGuarantee: true,
      });
      Alert.alert(t('fact:success.title'), t('fact:success.message'), [
        { text: t('common:actions.ok'), onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Submit fact error:', error);
      if (error.code === '42501' || error.message?.includes('policy')) {
        Alert.alert(t('errors:title'), t('fact:error.lowReputation'));
      } else {
        Alert.alert(t('errors:title'), t('fact:error.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reputationScore = user?.reputation_score ?? 0;
  const meetsReputationThreshold = reputationScore >= 100;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reputation Notice */}
        {!meetsReputationThreshold && (
          <View style={styles.reputationNotice}>
            <Ionicons name="information-circle-outline" size={18} color="#1D4ED8" />
            <Text style={styles.reputationNoticeText}>
              {t('fact:reputationNotice', { score: reputationScore })}
            </Text>
          </View>
        )}

        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#92400E" />
          <Text style={styles.warningText}>
            {t('fact:warning')}
          </Text>
        </View>

        {/* Fact Statement Input */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('fact:statement.label')}</Text>
          <TextInput
            testID="fact-statement"
            style={[styles.textInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
            placeholder={t('fact:statement.placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={MAX_CHARS}
            value={factStatement}
            onChangeText={setFactStatement}
            textAlignVertical="top"
          />
          <View style={styles.charCountRow}>
            <Text style={[
              styles.charCount,
              factStatement.length >= MAX_CHARS && styles.charCountLimit,
            ]}>
              {factStatement.length}/{MAX_CHARS}
            </Text>
          </View>
        </View>

        {/* Evidence Section */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('fact:evidence.label')}</Text>
          <Text style={styles.evidenceNote}>
            {t('fact:evidence.note')}
          </Text>
          <TextInput
            style={[styles.linkInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
            placeholder="https://..."
            placeholderTextColor={colors.textTertiary}
            value={evidenceUrl}
            onChangeText={setEvidenceUrl}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Category Tags */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('fact:category.label')}</Text>
          <View style={styles.chipsGrid}>
            {CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat.key);
              return (
                <TouchableOpacity
                  key={cat.key}
                  testID={`fact-category-${cat.key}`}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.ionicon as any}
                    size={14}
                    color={selected ? '#fff' : '#4A4A4A'}
                  />
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {t('common:factCategory.' + cat.key, { defaultValue: cat.key })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Truth Guarantee Section */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            testID="fact-truth-guarantee"
            style={styles.checkboxRow}
            onPress={() => setTruthGuarantee((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, truthGuarantee && styles.checkboxChecked]}>
              {truthGuarantee && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              {t('fact:truthGuarantee.label')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.guaranteeWarning}>
            {t('fact:truthGuarantee.warning')}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            testID="fact-submit"
            style={[styles.primaryButton, isSubmitDisabled && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? t('fact:submitting') : t('fact:submit')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>{t('common:actions.cancel')}</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },

  // Reputation Notice
  reputationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  reputationNoticeIcon: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1D4ED8',
  },
  reputationNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 19,
  },

  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  warningIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
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

  // Fact Statement Input
  textInput: {
    minHeight: 120,
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

  // Evidence Section
  evidenceNote: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 12,
  },
  linkInput: {
    fontSize: 15,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },

  // Category Chips
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EDE8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#1B4D3E',
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  chipLabelSelected: {
    color: 'white',
  },

  // Truth Guarantee
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  checkmark: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  guaranteeWarning: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
    paddingLeft: 34,
  },

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
