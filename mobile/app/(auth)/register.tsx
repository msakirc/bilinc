import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/src/services/supabase';
import { useTheme } from '@/src/theme/ThemeContext';
import { KVKK_CONSENT_TEXT } from '@/src/config/legal';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | 'invalid' | null>(null);
  const [usernameCheckTimeout, setUsernameCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  // KVKK açık rıza — cross-border data transfer consent (must NOT be pre-checked).
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const { signUp } = useAuthStore();

  // Dynamic styles that depend on insets
  const dynamicStyles = {
    scrollView: {
      flex: 1,
      marginTop: insets.top + 56, // Account for header height + safe area
    },
  };

  // Live username availability check
  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameStatus('invalid');
      return;
    }

    // Check format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameToCheck)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', usernameToCheck.toLowerCase())
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows returned = username available
        setUsernameStatus('available');
      } else if (data) {
        // Username exists
        setUsernameStatus('taken');
      } else {
        setUsernameStatus('available');
      }
    } catch (error) {
      console.error('Username check error:', error);
      setUsernameStatus(null);
    }
  };

  // Debounced username check
  useEffect(() => {
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }

    if (username.length >= 3) {
      const timeout = setTimeout(() => {
        checkUsernameAvailability(username);
      }, 500); // 500ms debounce
      setUsernameCheckTimeout(timeout);
    } else {
      setUsernameStatus(null);
    }

    return () => {
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }
    };
  }, [username]);

  const handleRegister = async () => {
    if (!username || !password || !confirmPassword) {
      Alert.alert(t('errors:title'), t('validation:fillAllFields'));
      return;
    }

    if (!acceptTerms) {
      Alert.alert(t('errors:title'), t('validation:mustAcceptTerms'));
      return;
    }

    if (!acceptKvkk) {
      Alert.alert(t('errors:title'), t('validation:mustAcceptConsent'));
      return;
    }

    if (usernameStatus !== 'available') {
      if (usernameStatus === 'taken') {
        Alert.alert(t('errors:title'), t('auth:register.usernameTakenAlert'));
      } else if (usernameStatus === 'invalid') {
        Alert.alert(t('errors:title'), t('auth:register.usernameInvalidAlert'));
      } else {
        Alert.alert(t('errors:title'), t('auth:register.usernameWaitAlert'));
      }
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('errors:title'), t('validation:passwordsNoMatch'));
      return;
    }

    if (password.length < 8) {
      Alert.alert(t('errors:title'), t('auth:register.passwordMin8'));
      return;
    }

    setLoading(true);
    try {
      await signUp(username, password);
      Alert.alert(t('errors:success'), t('auth:register.successMessage'));
      router.push('/(auth)/setup-security');
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert(
        t('auth:register.failedTitle'),
        error.message || t('auth:register.failedMessage'),
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
          <Text style={[styles.pageTitle, { color: colors.text }]}>{t('auth:register.pageTitle')}</Text>

          {/* Privacy Banner */}
          <View style={[styles.privacyBanner, { backgroundColor: colors.surface }]}>
            <View style={styles.privacyIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </View>
            <View style={styles.privacyContent}>
              <Text style={[styles.privacyTitle, { color: colors.text }]}>{t('auth:register.privacyTitle')}</Text>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                {t('auth:register.privacyText')}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <TextInput
                testID="register-username"
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                placeholder={t('auth:register.usernamePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.usernameStatusContainer}>
                {usernameStatus === 'checking' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="sync" size={13} color="#64748B" />
                    <Text style={[styles.usernameStatus, styles.checking]}> {t('validation:usernameChecking')}</Text>
                  </View>
                )}
                {usernameStatus === 'available' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={[styles.usernameStatus, styles.available]}> {t('validation:usernameAvailable')}</Text>
                  </View>
                )}
                {usernameStatus === 'taken' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="close-circle" size={13} color="#EF4444" />
                    <Text style={[styles.usernameStatus, styles.taken]}> {t('validation:usernameTaken')}</Text>
                  </View>
                )}
                {usernameStatus === 'invalid' && (
                  <View style={styles.statusRow}>
                    <Ionicons name="alert-circle" size={13} color="#F59E0B" />
                    <Text style={[styles.usernameStatus, styles.invalid]}> {t('validation:usernameRule')}</Text>
                  </View>
                )}
                {!usernameStatus && username.length >= 3 && (
                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    {t('validation:usernameRule')}
                  </Text>
                )}
                {!usernameStatus && username.length < 3 && username.length > 0 && (
                  <View style={styles.statusRow}>
                    <Ionicons name="alert-circle" size={13} color="#F59E0B" />
                    <Text style={[styles.usernameStatus, styles.invalid]}> {t('validation:usernameMin')}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                testID="register-password"
                style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                placeholder={t('auth:register.passwordPlaceholder')}
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

            <View style={styles.inputContainer}>
              <TextInput
                testID="register-confirm-password"
                style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                placeholder={t('auth:register.confirmPasswordPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons name={showConfirmPassword ? 'eye' : 'eye-off'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.requirementText, { color: colors.textSecondary }]}>{t('auth:register.passwordRequirement')}</Text>
          </View>

          {/* Security Note */}
          <View style={[styles.securityNote, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.securityText, { color: colors.text }]}>
              {t('auth:register.securityNote')}
            </Text>
          </View>

          {/* Terms of Service + Privacy Policy acceptance */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              testID="register-terms-checkbox"
              style={styles.checkboxTouchable}
              onPress={() => setAcceptTerms(!acceptTerms)}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View style={styles.termsTextContainer}>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                <Text
                  style={[styles.termsLink, { color: colors.primary }]}
                  onPress={() => router.push('/(auth)/legal/kosullar')}
                >
                  {t('auth:register.termsLink')}
                </Text>
                {t('auth:register.termsConjunction')}
                <Text
                  style={[styles.termsLink, { color: colors.primary }]}
                  onPress={() => router.push('/(auth)/legal/gizlilik')}
                >
                  {t('auth:register.privacyLink')}
                </Text>
                {t('auth:register.termsSuffix')}
              </Text>
            </View>
          </View>

          {/* KVKK açık rıza — cross-border data transfer (separate, required) */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              testID="register-kvkk-checkbox"
              style={styles.checkboxTouchable}
              onPress={() => setAcceptKvkk(!acceptKvkk)}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }, acceptKvkk && styles.checkboxChecked]}>
                {acceptKvkk && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View style={styles.termsTextContainer}>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                {KVKK_CONSENT_TEXT}
              </Text>
              <Text
                style={[styles.termsLink, { color: colors.primary, marginTop: 6 }]}
                onPress={() => router.push('/(auth)/legal/kvkk')}
              >
                {t('auth:register.kvkkLink')}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              testID="register-submit"
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? t('auth:register.submitting') : t('auth:register.submit')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {t('auth:register.haveAccount')}
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  privacyBanner: {
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
  privacyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  privacyIconText: {
    fontSize: 20,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 16,
    color: '#4A4A4A',
    lineHeight: 24,
  },
  form: {
    marginBottom: 16,
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
  inputHint: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  usernameStatusContainer: {
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  checking: {
    color: '#64748B',
  },
  available: {
    color: '#10B981',
  },
  taken: {
    color: '#EF4444',
  },
  invalid: {
    color: '#F59E0B',
  },
  termsContainer: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxTouchable: {
    marginRight: 12,
    marginTop: 2,
  },
  termsTextContainer: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 14,
    color: '#757575',
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: '#1B4D3E',
    textDecorationLine: 'underline',
  },
  passwordInput: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 64,
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
  requirementText: {
    fontSize: 14,
    color: '#757575',
    marginTop: -8,
    marginBottom: 16,
  },
  securityNote: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },

  linkText: {
    color: '#1B4D3E',
    textDecorationLine: 'underline',
  },
  actions: {},
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
