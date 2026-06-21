import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAuthStore } from '@/src/store/auth';
import { supabase } from '@/src/services/supabase';
import { useLanguage } from '@/src/i18n/useLanguage';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language, toggle: toggleLanguage } = useLanguage();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(
    user?.display_name || user?.username || ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUser();
      Alert.alert(t('settings:account.saveSuccessTitle'), t('settings:account.saveSuccessMessage'));
    } catch (err: any) {
      Alert.alert(t('settings:account.saveErrorTitle'), err.message || t('settings:account.saveErrorMessage'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings:account.danger.confirmTitle'),
      t('settings:account.danger.confirmMessage'),
      [
        { text: t('common:actions.cancel'), style: 'cancel' },
        {
          text: t('settings:account.danger.confirmYes'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings:account.danger.requestedTitle'),
              t('settings:account.danger.requestedMessage')
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Account Info Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings:account.infoTitle')}</Text>

        {/* Username (read-only) */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('common:labels.username')}</Text>
          <View style={[styles.readOnlyField, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.readOnlyText, { color: colors.text }]}>
              @{user?.username ?? '—'}
            </Text>
          </View>
          <Text style={[styles.fieldNote, { color: colors.textSecondary }]}>
            {t('settings:account.usernameNote')}
          </Text>
        </View>

        {/* Display Name (editable) */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('common:labels.displayName')}</Text>
          <TextInput
            testID="account-display-name"
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={user?.username ?? t('settings:account.displayNamePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>
      </View>

      {/* Language Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.langRow}>
          <Text style={[styles.langLabel, { color: colors.text }]}>{t('common:language.label')}</Text>
          <TouchableOpacity
            onPress={toggleLanguage}
            activeOpacity={0.7}
            style={[styles.langPill, { borderColor: colors.primary }]}
          >
            <Text style={[styles.langPillText, { color: colors.primary }]}>
              {language === 'en' ? t('common:language.english') : t('common:language.turkish')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>{saving ? t('settings:account.saving') : t('common:actions.save')}</Text>
      </TouchableOpacity>

      {/* Delete Account Card */}
      <View style={[styles.card, styles.dangerCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings:account.danger.title')}</Text>
        <Text style={[styles.dangerDescription, { color: colors.textSecondary }]}>
          {t('settings:account.danger.description')}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteButtonText}>{t('settings:account.danger.deleteButton')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dangerCard: {
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  langPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  langPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  readOnlyField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readOnlyText: {
    fontSize: 15,
  },
  fieldNote: {
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
