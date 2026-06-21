import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, Trans } from 'react-i18next';
import { DatabaseService } from '@/src/services/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatRelativeDate } from '@/src/i18n/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'all' | 'reviews' | 'facts';
type FactStatus = 'verified' | 'pending' | 'disputed';

interface ReviewContribution {
  id: string;
  type: 'review';
  businessName: string;
  content: string;
  rating: number;
  upvotes: number;
  date: string;
}

interface FactContribution {
  id: string;
  type: 'fact';
  businessName: string;
  content: string;
  status: FactStatus;
  upvotes: number;
  date: string;
}

type Contribution = ReviewContribution | FactContribution;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACT_UNLOCK_THRESHOLD = 100;

const LEVEL_ORDER = ['novice', 'contributor', 'trusted', 'expert'];

const LEVEL_MAX_SCORE: Record<string, number> = {
  novice: 100,
  contributor: 300,
  trusted: 700,
  expert: 9999,
};

function getLevelProgress(score: number, level: string): number {
  const prevMax: Record<string, number> = {
    novice: 0,
    contributor: 100,
    trusted: 300,
    expert: 700,
  };
  const prev = prevMax[level] ?? 0;
  const next = LEVEL_MAX_SCORE[level] ?? 9999;
  if (next === 9999) return 1;
  return Math.min((score - prev) / (next - prev), 1);
}

function getNextLevelKey(level: string): string {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return '';
  return LEVEL_ORDER[idx + 1] ?? '';
}

const STATUS_COLOR: Record<FactStatus, string> = {
  verified: '#10B981',
  pending: '#F59E0B',
  disputed: '#EF4444',
};

// ---------------------------------------------------------------------------
// Real-data helpers
// ---------------------------------------------------------------------------

const getBusinessName = (item: any) => item.listing?.name || item.businessName || 'Bilinmeyen';
const getContent = (item: any) => item.content || item.statement || '';
const getUpvotes = (item: any) => item.helpful_count ?? item.upvotes ?? 0;
const getDate = (item: any) => {
  if (item.date) return item.date;
  if (item.created_at) return formatRelativeDate(item.created_at);
  return '';
};
const getFactStatus = (item: any): FactStatus => {
  const s = item.verification_status || item.status;
  if (s === 'verified' || s === 'pending' || s === 'disputed') return s;
  return 'pending';
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name="star"
          size={14}
          color={s <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

function ContributionCard({ item, onDelete }: { item: any; onDelete: (id: string) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isReview = item.type === 'review';
  const factStatus = !isReview ? getFactStatus(item) : null;

  const handlePress = () => {
    console.log('Contribution pressed:', item.id, item.type);
  };

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={handlePress} android_ripple={{ color: '#e0e0e0' }}>
      {/* Business name + type badge */}
      <View style={styles.cardHeader}>
        <Text style={[styles.businessName, { color: colors.text }]} numberOfLines={1}>
          {getBusinessName(item)}
        </Text>
        <View style={[styles.typeBadge, isReview ? styles.reviewBadge : styles.factBadge]}>
          <Text style={styles.typeBadgeText}>
            {isReview ? t('activity:type.review') : t('activity:type.fact')}
          </Text>
        </View>
      </View>

      {/* Star rating for reviews */}
      {isReview && <StarRating rating={item.rating ?? 0} />}

      {/* Verification status for facts */}
      {!isReview && factStatus && (
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLOR[factStatus] },
            ]}
          />
          <Text
            style={[
              styles.statusLabel,
              { color: STATUS_COLOR[factStatus] },
            ]}
          >
            {t('activity:status.' + factStatus)}
          </Text>
        </View>
      )}

      {/* Content preview */}
      <Text style={[styles.contentPreview, { color: colors.textSecondary }]} numberOfLines={2}>
        {getContent(item)}
      </Text>

      {/* Footer: upvotes + date */}
      <View style={styles.cardFooter}>
        <View style={styles.upvotesRow}>
          <Ionicons name="arrow-up" size={13} color="#10B981" />
          <Text style={styles.upvotes}>{getUpvotes(item)}</Text>
        </View>
        <Text style={styles.dateText}>{getDate(item)}</Text>
      </View>

      {/* Actions: edit + delete */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert(t('activity:edit.title'), t('activity:edit.comingSoon'))}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={14} color={colors.primary} />
          <Text style={styles.editText}>{t('activity:actions.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            Alert.alert(t('activity:delete.title'), t('activity:delete.confirm'), [
              { text: t('common:actions.cancel'), style: 'cancel' },
              {
                text: t('activity:actions.delete'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (item.type === 'review') {
                      await DatabaseService.deleteReview(item.id);
                    } else {
                      await DatabaseService.deleteFact(item.id);
                    }
                    onDelete(item.id);
                  } catch (error) {
                    Alert.alert(t('activity:delete.errorTitle'), t('activity:delete.errorMessage'));
                  }
                },
              },
            ])
          }
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color="#EF4444" />
          <Text style={styles.deleteText}>{t('activity:actions.delete')}</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MyActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [contributions, setContributions] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivity = async () => {
    if (!user) { setDataLoading(false); return; }
    try {
      const [reviews, facts] = await Promise.all([
        DatabaseService.getUserReviews(user.id, 20).catch(() => []),
        DatabaseService.getUserFacts(user.id, 20).catch(() => []),
      ]);

      // Merge and sort by date
      const merged = [
        ...reviews.map((r: any) => ({ ...r, type: 'review' as const })),
        ...facts.map((f: any) => ({ ...f, type: 'fact' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setContributions(merged);
    } catch (error) {
      console.log('Activity data unavailable');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivity();
    setRefreshing(false);
  };

  const score = user?.reputation_score ?? 0;
  const level = user?.credibility_level ?? 'novice';

  const levelLabel = t('activity:level.' + level, { defaultValue: level });
  const nextLevelKey = getNextLevelKey(level);
  const nextLevelLabel = nextLevelKey ? t('activity:level.' + nextLevelKey) : '';
  const progress = getLevelProgress(score, level);

  const pointsToFactUnlock = Math.max(0, FACT_UNLOCK_THRESHOLD - score);
  const showFactNotice = score < FACT_UNLOCK_THRESHOLD;

  const displayContributions = contributions;

  const filteredContributions = activeTab === 'all'
    ? displayContributions
    : displayContributions.filter(c => c.type === (activeTab === 'reviews' ? 'review' : 'fact'));

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('activity:tabs.all') },
    { key: 'reviews', label: t('activity:tabs.reviews') },
    { key: 'facts', label: t('activity:tabs.facts') },
  ];

  const { colors } = useTheme();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header + filter tabs                                              */}
        {/* ---------------------------------------------------------------- */}
        <View style={[styles.headerBlock, { backgroundColor: colors.background }]}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t('activity:title')}</Text>
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.key && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Score summary card                                                */}
        {/* ---------------------------------------------------------------- */}
        <View style={[styles.scoreCard, { backgroundColor: colors.surface }]}>
          {/* Score + level badge */}
          <View style={styles.scoreTopRow}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelLabel}</Text>
            </View>
          </View>
          <Text style={[styles.scoreSubLabel, { color: colors.textSecondary }]}>{t('activity:score.subLabel')}</Text>

          {/* Progress bar */}
          {nextLevelLabel ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressLabel}>
                {t('activity:score.nextLevel', { level: nextLevelLabel })}
              </Text>
            </View>
          ) : (
            <Text style={styles.maxLevelLabel}>{t('activity:score.maxLevel')}</Text>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Fact reporting threshold notice                                   */}
        {/* ---------------------------------------------------------------- */}
        {showFactNotice && (
          <View style={styles.noticeBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#3B82F6" style={styles.noticeIcon} />
            <Text style={styles.noticeText}>
              <Trans
                i18nKey="activity:factNotice"
                values={{ points: t('activity:factNoticePoints', { count: pointsToFactUnlock }) }}
                components={{ bold: <Text style={styles.noticeBold} /> }}
              />
            </Text>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Contributions list                                                */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.listSection}>
          {dataLoading ? (
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginVertical: 40 }} />
          ) : filteredContributions.length > 0 ? (
            filteredContributions.map((item) => (
              <ContributionCard
                key={item.id}
                item={item}
                onDelete={(id) => setContributions(prev => prev.filter(c => c.id !== id))}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('activity:empty.title')}</Text>
              <Text style={styles.emptySubtitle}>{t('activity:empty.subtitle')}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/search')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyButtonText}>{t('activity:empty.cta')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PRIMARY = '#1B4D3E';
const BG = '#FAF9F7';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header + tabs
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
    backgroundColor: BG,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tabItem: {
    marginRight: 24,
    paddingBottom: 10,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#757575',
  },
  tabLabelActive: {
    color: PRIMARY,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 1,
  },

  // Score card
  scoreCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: PRIMARY,
    lineHeight: 64,
  },
  levelBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreSubLabel: {
    textAlign: 'center',
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  breakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    lineHeight: 15,
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 4,
  },
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 4,
    minWidth: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  maxLevelLabel: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Notice banner
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    gap: 10,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  noticeBold: {
    fontWeight: '700',
  },

  // List
  listSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },

  // Contribution card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  businessName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  reviewBadge: {
    backgroundColor: '#3B82F6',
  },
  factBadge: {
    backgroundColor: '#10B981',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentPreview: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upvotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upvotes: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE8',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: { fontSize: 13, color: '#1B4D3E', fontWeight: '500' },
  deleteText: { fontSize: 13, color: '#EF4444', fontWeight: '500' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#757575',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
