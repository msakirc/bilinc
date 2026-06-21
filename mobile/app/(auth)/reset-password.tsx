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
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/src/services/supabase';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<'username' | 'questions' | 'newPassword'>('username');
  const [username, setUsername] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dynamic styles that depend on insets
  const dynamicStyles = {
    scrollView: {
      flex: 1,
      marginTop: insets.top + 56, // Account for header height + safe area
    },
  };

  const handleGetQuestions = async () => {
    if (!username.trim()) {
      Alert.alert(t('errors:title'), t('auth:resetPassword.enterUsername'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_security_questions', {
        p_username: username.trim(),
      });

      if (error) {
        console.error('Get questions error:', error);
        Alert.alert(t('errors:title'), t('auth:resetPassword.questionsNotFound'));
        return;
      }

      if (!data || data.length === 0) {
        Alert.alert(t('errors:title'), t('auth:resetPassword.noQuestionsContactSupport'));
        return;
      }

      // Extract questions from the returned data
      console.log('Security questions data:', data);

      const userData = data[0]; // Should be only one row
      if (!userData) {
        Alert.alert(t('errors:title'), t('auth:resetPassword.invalidServerResponse'));
        return;
      }

      const extractedQuestions = [
        userData.question_1,
        userData.question_2
      ].filter(q => q && q.trim()); // Filter out null/empty values

      console.log('Extracted questions:', extractedQuestions);

      if (extractedQuestions.length !== 2) {
        Alert.alert(t('errors:title'), t('auth:resetPassword.questionsMisconfigured'));
        return;
      }

      setQuestions(extractedQuestions);
      setStep('questions');
    } catch (error: any) {
      console.error('Get questions error:', error);
      Alert.alert(t('errors:title'), t('auth:resetPassword.questionsFetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswers = async () => {
    if (!answers[0].trim() || !answers[1].trim()) {
      Alert.alert(t('errors:title'), t('auth:resetPassword.answerBothQuestions'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_security_answers', {
        p_username: username.trim(),
        p_answer_1: answers[0].trim(),
        p_answer_2: answers[1].trim(),
      });

      if (error) {
        console.error('Verify answers error:', error);
        Alert.alert(t('errors:title'), t('auth:resetPassword.answersVerifyFailed'));
        return;
      }

      if (!data || !data[0]?.success) {
        Alert.alert(t('errors:title'), data?.[0]?.message || t('auth:resetPassword.invalidAnswers'));
        return;
      }

      if (data[0]?.reset_token) {
        setResetToken(data[0].reset_token);
      }
      setStep('newPassword');
    } catch (error: any) {
      console.error('Verify answers error:', error);
      Alert.alert(t('errors:title'), t('auth:resetPassword.answersVerifyError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert(t('errors:title'), t('validation:fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('errors:title'), t('auth:resetPassword.passwordsNoMatch'));
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(t('errors:title'), t('auth:resetPassword.passwordMin8'));
      return;
    }

    if (!resetToken) {
      Alert.alert(t('errors:title'), t('auth:resetPassword.tokenNotFound'));
      setStep('questions');
      return;
    }

    setLoading(true);
    try {
      // Validate the token issued by verify_security_answers and update the
      // password inside the SECURITY DEFINER function reset_password_with_token
      // (see db/reset_password_function.sql). Anon clients cannot touch
      // auth.users directly, so the RPC does the bcrypt update server-side.
      const { data, error } = await supabase.rpc('reset_password_with_token', {
        p_username: username.trim(),
        p_reset_token: resetToken,
        p_new_password: newPassword,
      });

      if (error) {
        console.error('Reset RPC error:', error);
        Alert.alert(t('errors:title'), t('auth:resetPassword.resetFailed'));
        return;
      }

      if (!data || !data[0]?.success) {
        Alert.alert(t('errors:title'), data?.[0]?.message || t('auth:resetPassword.resetFailedShort'));
        return;
      }

      Alert.alert(
        t('errors:success'),
        t('auth:resetPassword.successMessage'),
        [{ text: t('common:actions.ok'), onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      console.error('Reset password error:', error);
      Alert.alert(t('errors:title'), t('auth:resetPassword.resetFailedShort'));
    } finally {
      setLoading(false);
    }
  };

  const renderUsernameStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('auth:resetPassword.usernameStepTitle')}</Text>
      <Text style={styles.stepDescription}>
        {t('auth:resetPassword.usernameStepDescription')}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('auth:resetPassword.usernamePlaceholder')}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          testID="reset-username"
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleGetQuestions}
          disabled={loading}
          testID="reset-step1-submit"
        >
          <Text style={styles.primaryButtonText}>
            {loading ? t('auth:resetPassword.loading') : t('auth:resetPassword.continue')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          testID="reset-step1-back"
        >
          <Text style={styles.secondaryButtonText}>{t('auth:resetPassword.backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuestionsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('auth:resetPassword.questionsStepTitle')}</Text>
      <Text style={styles.stepDescription}>
        {t('auth:resetPassword.questionsStepDescription')}
      </Text>

      <View style={styles.questionsContainer}>
        {questions.map((question, index) => (
          <View key={index} style={styles.questionContainer}>
            <Text style={styles.questionLabel}>{question}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth:resetPassword.answerPlaceholder')}
              value={answers[index]}
              onChangeText={(text) => {
                const newAnswers = [...answers];
                newAnswers[index] = text;
                setAnswers(newAnswers);
              }}
              autoCapitalize="words"
              autoCorrect={false}
              secureTextEntry={true}
              testID={`reset-answer-${index}`}
            />
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleVerifyAnswers}
          disabled={loading}
          testID="reset-step2-submit"
        >
          <Text style={styles.primaryButtonText}>
            {loading ? t('auth:resetPassword.verifying') : t('auth:resetPassword.verifyAnswers')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setStep('username')}
          testID="reset-step2-back"
        >
          <Text style={styles.secondaryButtonText}>{t('auth:resetPassword.back')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNewPasswordStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('auth:resetPassword.newPasswordStepTitle')}</Text>
      <Text style={styles.stepDescription}>
        {t('auth:resetPassword.newPasswordStepDescription')}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('auth:resetPassword.newPasswordPlaceholder')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          testID="reset-new-password"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#757575" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={t('auth:resetPassword.confirmPasswordPlaceholder')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          testID="reset-confirm-password"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Ionicons name={showConfirmPassword ? 'eye' : 'eye-off'} size={20} color="#757575" />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
          testID="reset-step3-submit"
        >
          <Text style={styles.primaryButtonText}>
            {loading ? t('auth:resetPassword.resetting') : t('auth:resetPassword.resetSubmit')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setStep('questions')}
          testID="reset-step3-back"
        >
          <Text style={styles.secondaryButtonText}>{t('auth:resetPassword.back')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => step === 'username' ? router.back() : setStep(step === 'questions' ? 'username' : 'questions')}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'username' ? t('auth:resetPassword.headerUsername') :
             step === 'questions' ? t('auth:resetPassword.headerQuestions') : t('auth:resetPassword.headerNewPassword')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={dynamicStyles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.mainContent}>
            {step === 'username' && renderUsernameStep()}
            {step === 'questions' && renderQuestionsStep()}
            {step === 'newPassword' && renderNewPasswordStep()}
          </View>
        </TouchableWithoutFeedback>
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
    height: 56,
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
    color: '#1B4D3E',
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
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 32,
  },
  stepContent: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    width: '100%',
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
  questionsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1B4D3E',
    fontSize: 16,
    fontWeight: '500',
  },
});
