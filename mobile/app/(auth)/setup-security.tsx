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

export default function SetupSecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const SECURITY_QUESTIONS = [
    t('auth:setupSecurity.questions.birthCity'),
    t('auth:setupSecurity.questions.firstPet'),
    t('auth:setupSecurity.questions.favoriteBook'),
    t('auth:setupSecurity.questions.firstSchool'),
    t('auth:setupSecurity.questions.mothersMaidenName'),
  ];
  const [question1, setQuestion1] = useState(SECURITY_QUESTIONS[0]);
  const [answer1, setAnswer1] = useState('');
  const [question2, setQuestion2] = useState(SECURITY_QUESTIONS[1]);
  const [answer2, setAnswer2] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [showDropdown2, setShowDropdown2] = useState(false);

  // Dynamic styles that depend on insets
  const dynamicStyles = {
    scrollView: {
      flex: 1,
      marginTop: insets.top + 56, // Account for header height + safe area
    },
  };

  const availableQuestionsForQ2 = SECURITY_QUESTIONS.filter(q => q !== question1);

  const handleContinue = async () => {
    if (!answer1.trim() || !answer2.trim()) {
      Alert.alert(t('errors:title'), t('auth:setupSecurity.answerBothQuestions'));
      return;
    }

    if (answer1.length > 50 || answer2.length > 50) {
      Alert.alert(t('errors:title'), t('auth:setupSecurity.answersMaxLength'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_security_questions', {
        p_question_1: question1,
        p_answer_1: answer1.trim(),
        p_question_2: question2,
        p_answer_2: answer2.trim(),
      });

      if (error) {
        console.error('Security questions error:', error);
        Alert.alert(t('errors:title'), error.message || t('auth:setupSecurity.saveFailed'));
        return;
      }

      console.log('Security questions saved successfully');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Security questions error:', error);
      Alert.alert(
        t('auth:setupSecurity.setupFailedTitle'),
        error.message || t('auth:setupSecurity.setupFailedMessage'),
        [{ text: t('common:actions.ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      t('auth:setupSecurity.skipDialogTitle'),
      t('auth:setupSecurity.skipDialogMessage'),
      [
        { text: t('common:actions.cancel'), style: 'cancel' },
        { text: t('auth:setupSecurity.skipDialogConfirm'), style: 'destructive', onPress: () => router.replace('/(tabs)') },
      ]
    );
  };

  const closeDropdowns = () => {
    setShowDropdown1(false);
    setShowDropdown2(false);
  };

  return (
    <>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Bilinç</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={dynamicStyles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableWithoutFeedback onPress={closeDropdowns}>
          <View style={styles.mainContent}>
          <Text style={styles.pageTitle}>{t('auth:setupSecurity.pageTitle')}</Text>

          {/* Explanation */}
          <View style={styles.explanation}>
            <Text style={styles.explanationMain}>{t('auth:setupSecurity.explanationMain')}</Text>
            <Text style={styles.explanationSub}>{t('auth:setupSecurity.explanationSub')}</Text>
          </View>

          {/* Security Question 1 */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>{t('auth:setupSecurity.question1Label')}</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowDropdown1(!showDropdown1)}
              >
                <Text style={styles.dropdownText}>{question1}</Text>
                <Ionicons name={showDropdown1 ? 'chevron-up' : 'chevron-down'} size={16} color="#757575" />
              </TouchableOpacity>
              {showDropdown1 && (
                <View style={styles.dropdownList}>
                  {SECURITY_QUESTIONS.filter(q => q !== question2).map((question) => (
                    <TouchableOpacity
                      key={question}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setQuestion1(question);
                        setShowDropdown1(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('auth:setupSecurity.answerPlaceholder')}
                value={answer1}
                onChangeText={(text) => {
                  if (text.length <= 50) {
                    setAnswer1(text);
                  }
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{answer1.length}/50</Text>
            </View>
          </View>

          {/* Security Question 2 */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>{t('auth:setupSecurity.question2Label')}</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowDropdown2(!showDropdown2)}
              >
                <Text style={styles.dropdownText}>{question2}</Text>
                <Ionicons name={showDropdown2 ? 'chevron-up' : 'chevron-down'} size={16} color="#757575" />
              </TouchableOpacity>
              {showDropdown2 && (
                <View style={styles.dropdownList}>
                  {SECURITY_QUESTIONS.filter(q => q !== question1).map((question) => (
                    <TouchableOpacity
                      key={question}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setQuestion2(question);
                        setShowDropdown2(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('auth:setupSecurity.answerPlaceholder')}
                value={answer2}
                onChangeText={(text) => {
                  if (text.length <= 50) {
                    setAnswer2(text);
                  }
                }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>{answer2.length}/50</Text>
            </View>
          </View>

          {/* Security Note */}
          <View style={styles.infoBox}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle-outline" size={20} color="#4A90D9" />
            </View>
            <Text style={styles.infoText}>
              {t('auth:setupSecurity.infoText')}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? t('auth:setupSecurity.saving') : t('auth:setupSecurity.continue')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>{t('auth:setupSecurity.skip')}</Text>
            </TouchableOpacity>

            <Text style={styles.skipWarning}>
              {t('auth:setupSecurity.skipWarning')}
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  explanation: {
    marginBottom: 24,
  },
  explanationMain: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  explanationSub: {
    fontSize: 14,
    color: '#757575',
  },
  questionSection: {
    marginBottom: 24,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdown: {
    backgroundColor: '#F0EDE8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  dropdownIcon: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputContainer: {
    position: 'relative',
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
  charCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  charCountText: {
    fontSize: 12,
    color: '#757575',
  },
  infoBox: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoIconText: {
    fontSize: 18,
  },
  infoText: {
    fontSize: 14,
    color: '#4A4A4A',
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#1B4D3E',
    fontSize: 16,
    fontWeight: '500',
  },
  skipWarning: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginTop: 8,
  },
});
