import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';

const STORAGE_KEY = 'bilinc_privacy_prefs';

interface PrivacyPrefs {
  publicProfile: boolean;
  showLocationInReviews: boolean;
  hideActivityHistory: boolean;
}

const DEFAULT_PREFS: PrivacyPrefs = {
  publicProfile: true,
  showLocationInReviews: false,
  hideActivityHistory: false,
};

const PRIVACY_KEYS: (keyof PrivacyPrefs)[] = [
  'publicProfile',
  'showLocationInReviews',
  'hideActivityHistory',
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch {
        // use defaults
      }
    };
    loadPrefs();
  }, []);

  const handleToggle = (key: keyof PrivacyPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      Alert.alert(t('settings:privacy.saveSuccessTitle'), t('settings:privacy.saveSuccessMessage'));
    } catch {
      Alert.alert(t('settings:privacy.saveErrorTitle'), t('settings:privacy.saveErrorMessage'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Privacy Toggles Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings:privacy.cardTitle')}</Text>

        {PRIVACY_KEYS.map((key, index) => (
          <View
            key={key}
            style={[
              styles.row,
              index < PRIVACY_KEYS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings:privacy.items.' + key + '.label')}</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                {t('settings:privacy.items.' + key + '.description')}
              </Text>
            </View>
            <Switch
              value={prefs[key]}
              onValueChange={() => handleToggle(key)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderLeftColor: colors.primary }]}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {t('settings:privacy.info')}
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>{saving ? t('settings:privacy.saving') : t('common:actions.save')}</Text>
      </TouchableOpacity>
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
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
    marginRight: 16,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
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
});
