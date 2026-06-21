/**
 * VideoCapture — guided in-app video capture for business ownership verification.
 *
 * Shows 3 ordered prompts, displays the liveness nonce (user reads aloud),
 * records up to 60 seconds via CameraView.recordAsync.
 * NO gallery/import — only live capture.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';

const MIN_GUIDANCE_MS = 30_000; // 30 seconds minimum recommended
const MAX_DURATION_S = 60; // hard cap

export interface VideoCaptureResult {
  uri: string;
  durationMs: number;
}

export interface VideoCaptureProps {
  nonce: string;
  onCaptured: (v: VideoCaptureResult) => void;
}

export default function VideoCapture({ nonce, onCaptured }: VideoCaptureProps) {
  const { t } = useTranslation('panel');
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      cameraRef.current?.stopRecording();
      return;
    }

    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted.granted) {
        Alert.alert(
          t('panel:claim.video.cameraPermissionTitle'),
          t('panel:claim.video.cameraPermissionMessage')
        );
        return;
      }
    }

    setIsRecording(true);
    const recordStart = Date.now();
    setStartTime(recordStart);

    try {
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_DURATION_S });
      const durationMs = Date.now() - recordStart;
      setIsRecording(false);
      setStartTime(null);

      if (result?.uri) {
        onCaptured({ uri: result.uri, durationMs });
      }
    } catch (error) {
      setIsRecording(false);
      setStartTime(null);
      console.error('Video capture error:', error);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {t('panel:claim.video.permissionChecking')}
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('panel:claim.video.permissionDeniedTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('panel:claim.video.permissionDeniedMessage')}
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>{t('panel:claim.video.allowButton')}</Text>
        </TouchableOpacity>
        {/* FIX 3: Escape hatch when permission is permanently denied */}
        <TouchableOpacity
          testID="video-open-settings"
          style={[styles.settingsButton, { borderColor: colors.primary }]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={[styles.settingsButtonText, { color: colors.primary }]}>
            {t('panel:claim.video.openSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Liveness nonce — user must read aloud during recording */}
      <View style={styles.nonceContainer}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
        <Text style={[styles.nonceLabel, { color: colors.textSecondary }]}>
          {t('panel:claim.video.livenessInstruction')}
        </Text>
        <Text style={[styles.nonceValue, { color: colors.text }]} testID="liveness-nonce">
          {nonce}
        </Text>
      </View>

      {/* Camera preview */}
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          mode="video"
          facing="back"
        />
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>{t('panel:claim.video.recording')}</Text>
          </View>
        )}
      </View>

      {/* Ordered prompts stepper */}
      <View style={[styles.promptsCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.promptsTitle, { color: colors.text }]}>
          {t('panel:claim.video.promptsTitle')}
        </Text>
        {(['shot1', 'shot2', 'shot3'] as const).map((key, index) => (
          <View key={key} style={styles.promptRow} testID={`video-shot-${index + 1}`}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            <Text style={[styles.promptText, { color: colors.text }]}>
              {t(`panel:claim.video.${key}`)}
            </Text>
          </View>
        ))}
        <Text style={[styles.durationHint, { color: colors.textTertiary }]}>
          {t('panel:claim.video.durationHint')}
        </Text>
      </View>

      {/* Record button */}
      <TouchableOpacity
        testID="record-button"
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={handleRecord}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isRecording ? 'stop-circle' : 'radio-button-on'}
          size={28}
          color="#fff"
        />
        <Text style={styles.recordButtonText}>
          {isRecording ? t('panel:claim.video.stopRecording') : t('panel:claim.video.startRecording')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  text: {
    textAlign: 'center',
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  permissionButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  settingsButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nonceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  nonceLabel: {
    fontSize: 12,
    flex: 1,
  },
  nonceValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    width: '100%',
    marginTop: 4,
    textAlign: 'center',
  },
  cameraWrapper: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  promptsCard: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  promptsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumber: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  durationHint: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  recordButtonActive: {
    backgroundColor: '#7F1D1D',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
