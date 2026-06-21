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

const STORAGE_KEY = 'bilinc_notification_prefs';

interface NotificationPrefs {
  newReviews: boolean;
  factVerifications: boolean;
  voteNotifications: boolean;
  systemUpdates: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  newReviews: true,
  factVerifications: true,
  voteNotifications: true,
  systemUpdates: true,
};

const NOTIFICATION_KEYS: (keyof NotificationPrefs)[] = [
  'newReviews',
  'factVerifications',
  'voteNotifications',
  'systemUpdates',
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
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

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      Alert.alert(t('settings:notifications.saveSuccessTitle'), t('settings:notifications.saveSuccessMessage'));
    } catch {
      Alert.alert(t('settings:notifications.saveErrorTitle'), t('settings:notifications.saveErrorMessage'));
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
      {/* Notification Toggles Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings:notifications.cardTitle')}</Text>

        {NOTIFICATION_KEYS.map((key, index) => (
          <View
            key={key}
            style={[
              styles.row,
              index < NOTIFICATION_KEYS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings:notifications.items.' + key + '.label')}</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                {t('settings:notifications.items.' + key + '.description')}
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

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>{saving ? t('settings:notifications.saving') : t('common:actions.save')}</Text>
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
