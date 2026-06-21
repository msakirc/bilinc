import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeContext';
import { getLegalDoc } from '@/src/config/legal';

export default function LegalDocScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const legalDoc = getLegalDoc(doc);

  return (
    <>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {legalDoc?.title ?? 'Yasal Belge'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={[{ flex: 1, marginTop: insets.top + 56, backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
      >
        {legalDoc ? (
          <Text style={[styles.body, { color: colors.text }]}>{legalDoc.body}</Text>
        ) : (
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Belge bulunamadı.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
});
