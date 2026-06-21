import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/src/store/auth';
import { useTheme } from '@/src/theme/ThemeContext';
import { DatabaseService } from '@/src/services/database';
import { formatRelativeDate, formatMonthYear } from '@/src/i18n/format';
import { useLanguage } from '@/src/i18n/useLanguage';

// --- Helpers ---
const CREDIBILITY_COLOR: Record<string, string> = {
  novice:      '#757575',
  contributor: '#3B82F6',
  trusted:     '#10B981',
  expert:      '#F59E0B',
};

type SettingsKey = 'account' | 'notifications' | 'privacy' | 'help';

type SettingsEntry = {
  key: SettingsKey;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const SETTINGS_ITEMS: SettingsEntry[] = [
  { key: 'account',       icon: 'person-circle-outline' },
  { key: 'notifications', icon: 'notifications-outline' },
  { key: 'privacy',       icon: 'lock-closed-outline' },
  { key: 'help',          icon: 'help-circle-outline' },
];

// --- Main Component ---
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language, toggle: toggleLanguage } = useLanguage();
  const { user, signOut } = useAuthStore();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();

  const [stats, setStats] = useState({ totalReviews: 0, totalFacts: 0, helpfulVotes: 0, factVerificationRate: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const credibilityLevel = user?.credibility_level ?? '';
  const credibilityColor = CREDIBILITY_COLOR[credibilityLevel] ?? '#757575';
  const credibilityLabel = credibilityLevel
    ? t('common:credibility.' + credibilityLevel, { defaultValue: credibilityLevel })
    : '—';

  const memberSince = user?.created_at ? formatMonthYear(user.created_at) : '-';

  const loadProfile = async () => {
    if (!user) { setDataLoading(false); return; }
    try {
      const [userStats, reviews, facts] = await Promise.all([
        DatabaseService.getUserStats(user.id).catch(() => null),
        DatabaseService.getUserReviews(user.id, 3).catch(() => []),
        DatabaseService.getUserFacts(user.id, 3).catch(() => []),
      ]);

      if (userStats) setStats(userStats);

      // Merge recent activity
      const recent = [
        ...reviews.map((r: any) => ({
          id: r.id,
          businessName: r.listing?.name || 'Bilinmeyen',
          type: 'review' as const,
          date: formatRelativeDate(r.created_at),
        })),
        ...facts.map((f: any) => ({
          id: f.id,
          businessName: f.listing?.name || 'Bilinmeyen',
          type: 'fact' as const,
          date: formatRelativeDate(f.created_at),
        })),
      ].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

      setRecentActivity(recent);
    } catch (error) {
      console.log('Profile data unavailable');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSettingsTap = (key: SettingsKey) => {
    if (key === 'account') {
      router.push('/settings/account');
    } else if (key === 'notifications') {
      router.push('/settings/notifications');
    } else if (key === 'privacy') {
      router.push('/settings/privacy');
    } else {
      Alert.alert(t('profile:comingSoon.title'), t('profile:comingSoon.message'));
    }
  };

  const handleThemeToggle = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── 1. Profile Header Card ── */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            {user?.username ? (
              <Text style={styles.avatarText}>
                {user.username[0].toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person" size={32} color="#fff" />
            )}
          </View>

          <Text style={[styles.username, { color: colors.text }]}>@{user?.username ?? '—'}</Text>

          <Text style={[styles.score, { color: colors.primary }]}>
            {t('profile:score', { score: user?.reputation_score ?? 0 })}
          </Text>

          <View style={[styles.badge, { backgroundColor: credibilityColor + '20' }]}>
            <Text style={[styles.badgeText, { color: credibilityColor }]}>
              {credibilityLabel}
            </Text>
          </View>
        </View>

        {/* ── 2. Reputation Stats ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile:stats.title')}</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.totalReviews}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('profile:stats.totalReviews')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.totalFacts}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('profile:stats.totalFacts')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.helpfulVotes}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('profile:stats.helpfulVotes')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>%{stats.factVerificationRate}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('profile:stats.verificationRate')}</Text>
            </View>
          </View>

          <View style={[styles.memberRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.memberLabel, { color: colors.textTertiary }]}>{t('profile:stats.memberSince')}</Text>
            <Text style={[styles.memberValue, { color: colors.text }]}>{memberSince}</Text>
          </View>
        </View>

        {/* ── 3. Recent Activity ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile:recentActivity.title')}</Text>

          <View style={[styles.activityList, { backgroundColor: colors.surface }]}>
            {dataLoading ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} color={colors.primary} />
            ) : recentActivity.length === 0 ? (
              <Text style={[styles.emptyActivity, { color: colors.textTertiary }]}>{t('common:empty.noActivity')}</Text>
            ) : (
              recentActivity.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.activityItem,
                    index < recentActivity.length - 1 && [styles.activityItemBorder, { borderBottomColor: colors.borderLight }],
                  ]}
                >
                  <View style={styles.activityLeft}>
                    <Text style={[styles.activityBusiness, { color: colors.text }]}>{item.businessName}</Text>
                    <Text style={[styles.activityDate, { color: colors.textQuaternary }]}>{item.date}</Text>
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      item.type === 'fact' ? styles.typeBadgeFact : styles.typeBadgeReview,
                      { backgroundColor: item.type === 'fact' ? (isDark ? 'rgba(30, 132, 73, 0.2)' : '#EAFAF1') : (isDark ? 'rgba(41, 128, 185, 0.2)' : '#EBF5FB') },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        item.type === 'fact'
                          ? styles.typeBadgeTextFact
                          : styles.typeBadgeTextReview,
                      ]}
                    >
                      {item.type === 'fact' ? t('profile:type.fact') : t('profile:type.review')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── 4. Settings ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile:settings.title')}</Text>

          <View style={[styles.settingsList, { backgroundColor: colors.surface }]}>
            {SETTINGS_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.settingsItem,
                  index < SETTINGS_ITEMS.length - 1 && [styles.settingsItemBorder, { borderBottomColor: colors.borderLight }],
                ]}
                onPress={() => handleSettingsTap(item.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={20} color={colors.text} style={styles.settingsItemIcon} />
                <Text style={[styles.settingsItemText, { color: colors.text }]}>{t('profile:settings.' + item.key)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}

            {/* Theme toggle row */}
            <View style={[styles.settingsItem, styles.settingsItemBorder, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
              <Ionicons
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={20}
                color={colors.text}
                style={styles.settingsItemIcon}
              />
              <Text style={[styles.settingsItemText, { color: colors.text, flex: 1 }]}>
                {t('profile:settings.theme', { mode: isDark ? t('profile:settings.themeDark') : t('profile:settings.themeLight') })}
              </Text>
              <Switch
                testID="profile-theme-switch"
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ false: '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Language toggle row */}
            <View style={[styles.settingsItem, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
              <Ionicons
                name="language-outline"
                size={20}
                color={colors.text}
                style={styles.settingsItemIcon}
              />
              <Text style={[styles.settingsItemText, { color: colors.text, flex: 1 }]}>
                {t('common:language.label')}
              </Text>
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
        </View>

        {/* ── 5. Sign Out ── */}
        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.signOutText}>{t('common:nav.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1B4D3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  score: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4D3E',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Section wrapper
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1B4D3E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
  },
  memberRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  memberLabel: {
    fontSize: 14,
    color: '#666666',
  },
  memberValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // Activity
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  activityLeft: {
    flex: 1,
    marginRight: 12,
  },
  activityBusiness: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#999999',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeReview: {
    backgroundColor: '#EBF5FB',
  },
  typeBadgeFact: {
    backgroundColor: '#EAFAF1',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadgeTextReview: {
    color: '#2980B9',
  },
  typeBadgeTextFact: {
    color: '#1E8449',
  },
  emptyActivity: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Settings
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  settingsItemIcon: {
    marginRight: 12,
  },
  settingsItemText: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  langPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Sign Out
  signOutSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
