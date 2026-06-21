import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/src/store/auth';
import { useTheme } from '@/src/theme/ThemeContext';
import { useGuest } from '@/app/_layout';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { setGuest } = useGuest();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();

  // Dynamic styles that depend on insets
  const dynamicStyles = {
    scrollView: {
      flex: 1,
      marginTop: insets.top + 56, // Account for header height + safe area
    },
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('errors:title'), t('validation:fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(username, password);
      setGuest(false); // Clear guest mode on login
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        t('errors:loginFailed'),
        error.message || t('auth:login.failedMessage'),
        [{ text: t('common:actions.ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Bilinç</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={[dynamicStyles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>{t('auth:login.pageTitle')}</Text>

          {/* Privacy Reminder */}
          <View style={[styles.privacyCard, { backgroundColor: colors.surface }]}>
            <View style={styles.privacyIcon}>
              <Ionicons name="lock-closed" size={22} color="#fff" />
            </View>
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              {t('auth:login.privacyReminder')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <TextInput
                testID="login-username"
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                placeholder={t('auth:login.usernamePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                testID="login-password"
                style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                placeholder={t('auth:login.passwordPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.forgotPassword}>
              <TouchableOpacity testID="login-forgot" onPress={() => router.push('/(auth)/reset-password')}>
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>{t('auth:login.forgotPassword')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              testID="login-submit"
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? t('auth:login.submitting') : t('auth:login.submit')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="login-register"
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {t('auth:login.noAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'white',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56, // h-14
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B4D3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },

  scrollContent: {
    paddingBottom: 32,
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 32,
  },
  privacyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  privacyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1B4D3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  privacyIconText: {
    fontSize: 20,
  },
  privacyText: {
    fontSize: 16,
    color: '#4A4A4A',
    flex: 1,
    lineHeight: 24,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  passwordInput: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 64, // Space for larger eye button
    fontSize: 16,
    color: '#1A1A1A',
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: [{ translateY: -24 }],
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#1B4D3E',
    fontWeight: '500',
  },
  actions: {
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
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
});
