/**
 * ClaimScreen — business ownership claim via video verification.
 *
 * Flow (top-to-bottom):
 *   1. Intro / why panel
 *   2. Role picker (owner / manager / employee)
 *   3. VKN input — 10-digit, validated with isValidVKN; inline error on blur
 *   4. Aydınlatma metni scroll area (KVKK/verification disclosure)
 *   5. Rıza checkbox (BUSINESS_VERIFICATION_CONSENT_TEXT) — separate, unchecked
 *   6. VideoCapture component with computed liveness nonce
 *   7. Submit button — disabled until VKN valid + rıza checked + video captured
 *
 * GPS is best-effort (doesn't block submit if denied).
 */

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useTheme } from '@/src/theme/ThemeContext';
import { DatabaseService } from '@/src/services/database';
import { useAuthStore } from '@/src/store/auth';
import { isValidVKN } from '@/src/lib/vkn';
import VideoCapture, { VideoCaptureResult } from '@/src/components/verification/VideoCapture';
import {
  BUSINESS_VERIFICATION_CONSENT_TEXT,
  LEGAL_DOCS,
} from '@/src/config/legal';
import type { ClaimRole } from '@/src/types';

// Re-export so external consumers (e.g. tests that previously imported from here) still resolve.
export { BUSINESS_VERIFICATION_CONSENT_TEXT };

// Aydınlatma body sourced from LEGAL_DOCS to keep a single source of truth.
const AYDINLATMA_BODY = LEGAL_DOCS['isletme-dogrulama'].body;

// ---------------------------------------------------------------------------
// Role picker options
// ---------------------------------------------------------------------------
const ROLES: { key: ClaimRole; ionicon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'owner', ionicon: 'person' },
  { key: 'manager', ionicon: 'briefcase-outline' },
  { key: 'employee', ionicon: 'people-outline' },
];

export default function ClaimScreen() {
  const router = useRouter();
  const { t } = useTranslation('panel');
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { user } = useAuthStore();

  // Form state
  const [role, setRole] = useState<ClaimRole>('owner');
  const [vkn, setVkn] = useState('');
  const [vknTouched, setVknTouched] = useState(false);
  const [rizaChecked, setRizaChecked] = useState(false);
  const [capturedVideo, setCapturedVideo] = useState<VideoCaptureResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // FIX 2: Track saved claim ID to avoid duplicate-pending on upload retry
  const [savedClaimId, setSavedClaimId] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);

  // GPS — best-effort, doesn't block submit
  const [capturedLat, setCapturedLat] = useState<number | undefined>(undefined);
  const [capturedLng, setCapturedLng] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCapturedLat(loc.coords.latitude);
          setCapturedLng(loc.coords.longitude);
        }
      } catch {
        // GPS denied or failed — silently ignore
      }
    })();
  }, []);

  // Liveness nonce — computed once from listing id
  const nonce = useMemo(
    () => 'BILINC-' + (id ?? '').slice(-4) + String(Date.now()).slice(-6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  );

  const vknValid = isValidVKN(vkn);
  const isSubmitDisabled =
    !vknValid || !rizaChecked || !capturedVideo || submitting;

  const handleSubmit = async () => {
    if (isSubmitDisabled || !user) return;

    setSubmitting(true);
    setUploadFailed(false);
    try {
      // FIX 2: Only create a new claim row if we don't already have one
      let claimId = savedClaimId;
      if (!claimId) {
        claimId = await DatabaseService.createClaim({
          listingId: id,
          userId: user.id,
          role,
          verificationMethod: 'video',
          taxNumber: vkn,
          consentAt: new Date().toISOString(),
          capturedLat,
          capturedLng,
          livenessNonce: nonce,
        });
        setSavedClaimId(claimId);
      }

      await DatabaseService.uploadVerificationVideo(
        user.id,
        claimId,
        capturedVideo!.uri
      );

      // Success — reset retry state
      setSavedClaimId(null);
      setSuccess(true);
    } catch (error: any) {
      console.error('Claim submit error:', error);

      // FIX 2: If claim was already created but upload failed, show retry-specific message
      if (savedClaimId) {
        setUploadFailed(true);
        Alert.alert(
          t('panel:claim.errorTitle'),
          t('panel:claim.uploadError')
        );
      } else {
        Alert.alert(
          t('panel:claim.errorTitle'),
          t('panel:claim.errorGeneric')
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guest wall ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View
        style={[styles.container, styles.centeredMessage, { backgroundColor: colors.background }]}
      >
        <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.guestTitle, { color: colors.text }]}>
          {t('panel:claim.guestTitle')}
        </Text>
        <Text style={[styles.guestSubtitle, { color: colors.textTertiary ?? '#757575' }]}>
          {t('panel:claim.guestWall')}
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
          testID="claim-guest-back"
        >
          <Text style={styles.primaryButtonText}>{t('panel:claim.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <View
        style={[styles.container, styles.centeredMessage, { backgroundColor: colors.background }]}
        testID="claim-success"
      >
        <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
        <Text style={[styles.guestTitle, { color: colors.text }]}>
          {t('panel:claim.successTitle')}
        </Text>
        <Text style={[styles.guestSubtitle, { color: colors.textTertiary ?? '#757575' }]}>
          {t('panel:claim.successMessage')}
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
          testID="claim-success-back"
        >
          <Text style={styles.primaryButtonText}>{t('panel:claim.ok')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. Intro ───────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.introRow}>
            <Ionicons name="storefront-outline" size={28} color={colors.primary} />
            <Text style={[styles.introTitle, { color: colors.text }]}>
              {t('panel:claim.introTitle')}
            </Text>
          </View>
          <Text style={[styles.introBody, { color: colors.textSecondary ?? '#4A4A4A' }]}>
            {t('panel:claim.introWhy')}
          </Text>
          <View style={styles.infoBullets}>
            {(
              [
                { icon: 'videocam-outline' as const, key: 'introBullet1' },
                { icon: 'card-outline' as const, key: 'introBullet2' },
                { icon: 'time-outline' as const, key: 'introBullet3' },
              ] as const
            ).map(({ icon, key }) => (
              <View key={key} style={styles.infoBulletRow}>
                <Ionicons name={icon} size={16} color={colors.primary} />
                <Text style={[styles.infoBulletText, { color: colors.textSecondary ?? '#4A4A4A' }]}>
                  {t(`claim.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 2. Role picker ─────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('panel:claim.sectionRole')}</Text>
          <View style={styles.rolesRow}>
            {ROLES.map((r) => {
              const selected = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  testID={`claim-role-${r.key}`}
                  style={[
                    styles.roleChip,
                    selected && styles.roleChipSelected,
                    { borderColor: selected ? colors.primary : colors.border ?? '#E5E7EB' },
                  ]}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={r.ionicon}
                    size={18}
                    color={selected ? colors.primary : colors.textTertiary ?? '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.roleChipLabel,
                      { color: selected ? colors.primary : colors.textSecondary ?? '#4A4A4A' },
                    ]}
                  >
                    {t(`claim.roles.${r.key}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 3. VKN input ───────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('panel:claim.sectionVkn')}</Text>
          <TextInput
            testID="claim-vkn"
            style={[
              styles.vknInput,
              {
                color: colors.text,
                backgroundColor: colors.input ?? '#FAFAFA',
                borderColor:
                  vknTouched && !vknValid
                    ? '#EF4444'
                    : colors.border ?? '#E5E7EB',
              },
            ]}
            placeholder="0000000000"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            maxLength={10}
            value={vkn}
            onChangeText={setVkn}
            onBlur={() => setVknTouched(true)}
            autoCorrect={false}
          />
          {vknTouched && !vknValid && (
            <Text testID="claim-vkn-error" style={styles.vknError}>
              {t('panel:claim.vknError')}
            </Text>
          )}
          <Text style={[styles.vknHint, { color: colors.textTertiary ?? '#9CA3AF' }]}>
            {t('panel:claim.vknHint')}
          </Text>
        </View>

        {/* ── 4. Aydınlatma metni ─────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('panel:claim.sectionAydinlatma')}</Text>
          <ScrollView
            testID="claim-aydinlatma-scroll"
            style={[
              styles.aydinlatmaScroll,
              { backgroundColor: colors.background ?? '#FAF9F7' },
            ]}
            nestedScrollEnabled
          >
            <Text
              testID="claim-aydinlatma-text"
              style={[styles.aydinlatmaText, { color: colors.textSecondary ?? '#4A4A4A' }]}
            >
              {AYDINLATMA_BODY}
            </Text>
          </ScrollView>
        </View>

        {/* ── 5. Rıza checkbox ────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            testID="claim-riza-checkbox"
            style={styles.checkboxRow}
            onPress={() => setRizaChecked((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rizaChecked && styles.checkboxChecked]}>
              {rizaChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              {BUSINESS_VERIFICATION_CONSENT_TEXT}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. VideoCapture ─────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.sectionLabel}>{t('panel:claim.sectionVideo')}</Text>
          {capturedVideo ? (
            <View style={styles.capturedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text style={styles.capturedText}>
                {t('panel:claim.capturedVideo', { seconds: Math.round(capturedVideo.durationMs / 1000) })}
              </Text>
              <TouchableOpacity
                testID="claim-retake-video"
                onPress={() => {
                  setCapturedVideo(null);
                  setUploadFailed(false);
                }}
              >
                <Text style={styles.retakeText}>{t('panel:claim.retake')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <VideoCapture
              nonce={nonce}
              onCaptured={(result) => setCapturedVideo(result)}
            />
          )}
        </View>

        {/* ── 7. Submit button ────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          {/* FIX 2: Retry-upload button shown when upload failed but claim row exists */}
          {uploadFailed && savedClaimId && capturedVideo ? (
            <TouchableOpacity
              testID="claim-retry-upload"
              style={styles.primaryButton}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryButtonText}>
                {submitting ? t('panel:claim.submittingButton') : t('panel:claim.retryUpload')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="claim-submit"
              style={[
                styles.primaryButton,
                isSubmitDisabled && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              accessibilityState={{ disabled: isSubmitDisabled }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryButtonText}>
                {submitting ? t('panel:claim.submittingButton') : t('panel:claim.submitButton')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              {t('panel:claim.cancel')}
            </Text>
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
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 14,
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

  // ── Card ──────────────────────────────────────────────────────────────
  card: {
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

  // ── Intro ─────────────────────────────────────────────────────────────
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  introTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  introBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  infoBullets: {
    gap: 8,
  },
  infoBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoBulletText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  // ── Roles ────────────────────────────────────────────────────────────
  rolesRow: {
    gap: 10,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roleChipSelected: {
    backgroundColor: '#F0FDF4',
  },
  roleChipLabel: {
    fontSize: 15,
    fontWeight: '500',
  },

  // ── VKN ─────────────────────────────────────────────────────────────
  vknInput: {
    fontSize: 20,
    letterSpacing: 2,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    textAlign: 'center',
  },
  vknError: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 6,
  },
  vknHint: {
    fontSize: 12,
    marginTop: 6,
  },

  // ── Aydınlatma ───────────────────────────────────────────────────────
  aydinlatmaScroll: {
    maxHeight: 180,
    borderRadius: 8,
    padding: 10,
  },
  aydinlatmaText: {
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Checkbox ────────────────────────────────────────────────────────
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Captured banner ──────────────────────────────────────────────────
  capturedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
  },
  capturedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  retakeText: {
    fontSize: 13,
    color: '#1B4D3E',
    fontWeight: '600',
  },

  // ── Action Buttons ───────────────────────────────────────────────────
  actionsSection: {
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
