import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/ThemeContext';
import { DatabaseService } from '@/src/services/database';
import { useAuthStore } from '@/src/store/auth';
import { formatRelativeDate } from '@/src/i18n/format';

export default function BusinessDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [userRating, setUserRating] = useState(0);
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [listing, setListing] = useState<any>(null);
  const [facts, setFacts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [tagsisWarning, setTagsisWarning] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBusinessData = async () => {
    if (!id) return;
    try {
      const [listingData, factsData, reviewsData] = await Promise.all([
        DatabaseService.getListing(id).catch(() => null),
        DatabaseService.getListingFacts(id, 5).catch(() => []),
        DatabaseService.getListingReviews(id, 5).catch(() => []),
      ]);
      if (listingData) setListing(listingData);
      if (factsData.length > 0) setFacts(factsData);
      if (reviewsData.length > 0) setReviews(reviewsData);

      // Check for tağşiş — look for safety-category verified facts
      const safetyFacts = factsData.filter((f: any) => f.category === 'safety' && f.verification_status === 'verified');
      if (safetyFacts.length > 0) {
        setTagsisWarning(safetyFacts[0]);
      }
    } catch (error) {
      console.log('Business data unavailable');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { loadBusinessData(); }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBusinessData();
    setRefreshing(false);
  };

  const handleVote = async (itemId: string, voteType: 'up' | 'down', itemType: 'fact' | 'review') => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    const currentVote = votes[itemId];
    const newVote = currentVote === voteType ? null : voteType;
    setVotes(prev => ({ ...prev, [itemId]: newVote }));
    try {
      if (newVote === null) {
        if (itemType === 'fact') await DatabaseService.deleteFactVote(itemId);
        else await DatabaseService.deleteReviewVote(itemId);
      } else {
        const dbVoteType = newVote === 'up' ? 'helpful' : 'not_helpful';
        if (itemType === 'fact') await DatabaseService.voteOnFact(itemId, dbVoteType);
        else await DatabaseService.voteOnReview(itemId, dbVoteType);
      }
    } catch {
      setVotes(prev => ({ ...prev, [itemId]: currentVote || null }));
    }
  };

  const biz = listing;
  const displayFacts = facts;
  const displayReviews = reviews;

  // Helpers
  const getTitle = (f: any) => f.statement || f.title;
  const getName = (item: any) => item.user?.username || item.user;
  const getScore = (item: any) => item.user?.reputation_score ?? item.score;
  const getLevel = (item: any) => item.user?.credibility_level || item.level;
  const getStatus = (f: any) => f.verification_status || f.status;
  const getTime = (item: any) => {
    if (item.timeAgo) return item.timeAgo;
    if (!item.created_at) return '';
    return formatRelativeDate(item.created_at);
  };

  const statusMap: Record<string, { bg: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
    verified: { bg: colors.verified, label: t('common:verification.verified'), icon: 'checkmark-circle' },
    pending: { bg: colors.pending, label: t('common:verification.pending'), icon: 'time' },
    disputed: { bg: colors.disputed, label: t('common:verification.disputed'), icon: 'alert-circle' },
  };

  if (!biz) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 40 }}>
        {dataLoading
          ? <ActivityIndicator size="large" color={colors.primary} />
          : <Text style={{ fontSize: 15, color: colors.textSecondary }}>{t('business:notFound')}</Text>}
      </View>
    );
  }

  const rating = biz.average_rating || 0;
  const reviewCount = biz.total_reviews || 0;
  // Catalog categories come as { slug, primary } objects; legacy/mock data came
  // as plain strings. Normalize to label strings (primary first) so they can be
  // rendered in <Text> — rendering the raw object crashes with "Objects are not
  // valid as a React child".
  const cats: string[] = (biz.categories || (biz.category_name ? [biz.category_name] : []))
    .slice()
    .sort((a: any, b: any) => (b?.primary ? 1 : 0) - (a?.primary ? 1 : 0))
    .map((c: any) => (typeof c === 'string' ? c : c?.slug))
    .filter(Boolean);

  const shadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 6,
    elevation: 2,
  };

  const VoteButton = ({ itemId, dir, type, count }: { itemId: string; dir: 'up' | 'down'; type: 'fact' | 'review'; count: number }) => {
    const active = votes[itemId] === dir;
    const c = dir === 'up' ? colors.verified : colors.disputed;
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        testID={`${type}-vote-${dir}-${itemId}`}
        onPress={() => handleVote(itemId, dir, type)}
        style={[s.voteBtn, { backgroundColor: active ? (isDark ? `${c}33` : `${c}18`) : colors.surfaceSecondary }]}
      >
        <Ionicons name={dir === 'up' ? 'thumbs-up' : 'thumbs-down'} size={13} color={active ? c : colors.textTertiary} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? c : colors.textSecondary }}>{count + (active ? 1 : 0)}</Text>
      </TouchableOpacity>
    );
  };

  const Star = ({ filled, size = 16 }: { filled: boolean; size?: number }) => (
    <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? colors.starFilled : colors.starEmpty} />
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {dataLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />}

      {/* Hero image — edge-to-edge */}
      <View style={{ width: '100%', height: 220 + insets.top, backgroundColor: colors.surfaceSecondary }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="storefront-outline" size={72} color={colors.textTertiary} />
        </View>
        {/* Floating back + share buttons */}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? '#fff' : '#1A1A1A'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={18} color={isDark ? '#fff' : '#1A1A1A'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ padding: 16, marginTop: -24 }}>
        {/* Info Card — overlaps hero image slightly */}
        <View style={[s.card, shadow, { backgroundColor: colors.surface, padding: 16 }]}>
          {/* Business name */}
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>{biz.name}</Text>

          {/* Rating row — number first (hero), then stars as confirmation, then count */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{rating.toFixed(1)}</Text>
            <View style={{ flexDirection: 'row', gap: 1, marginLeft: 8 }}>
              {[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= Math.round(rating)} size={15} />)}
            </View>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginLeft: 6 }}>({reviewCount})</Text>
          </View>

          {/* Category tags + claimed */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cats.map((c: string, i: number) => (
              <View key={c} style={[s.pill, { backgroundColor: i === 0 ? colors.primary : colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: i === 0 ? '#fff' : colors.textSecondary }}>{c}</Text>
              </View>
            ))}
            {(biz.is_claimed || biz.claimed) && (
              <View style={[s.pill, { backgroundColor: colors.verified }]}>
                <Ionicons name="checkmark-circle" size={12} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff', marginLeft: 2 }}>{t('business:claimedBadge')}</Text>
              </View>
            )}
          </View>

          {/* Location + OSM attribution (ODbL requires visible attribution for OSM-sourced data) */}
          {(biz.district_name || biz.city_name || biz.address) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
              <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {biz.address || [biz.district_name, biz.city_name].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 6 }}>
            {t('business:osmAttribution')}
          </Text>
        </View>

        {/* Tağşiş Warning Banner — auto-detected */}
        {tagsisWarning && (
          <View style={[shadow, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#EF4444' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>{t('business:tagsis.title')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                <Ionicons name="shield" size={9} color="#fff" />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{t('business:tagsis.official')}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: isDark ? '#FCA5A5' : '#991B1B', lineHeight: 18 }}>
              {tagsisWarning.statement || t('business:tagsis.defaultStatement')}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
              {t('business:tagsis.source')}
            </Text>
          </View>
        )}

        {/* Rate this */}
        <View style={[s.card, shadow, { backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginRight: 4 }}>{t('business:rate')}</Text>
          {[1, 2, 3, 4, 5].map(i => (
            <TouchableOpacity key={i} onPress={() => setUserRating(i)} style={{ padding: 4 }}>
              <Ionicons name={i <= userRating ? 'star' : 'star-outline'} size={24} color={i <= userRating ? colors.starFilled : colors.starEmpty} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Facts */}
        <View style={{ marginTop: 8 }}>
          <Text testID="business-facts-section" style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12, letterSpacing: 0.3 }}>
            {t('business:sections.facts')}
          </Text>

          {!dataLoading && displayFacts.length === 0 && (
            <View style={[s.card, shadow, { backgroundColor: colors.surface, padding: 16, alignItems: 'center' }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{t('business:empty.noFacts')}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('business:empty.noFactsSubtitle')}</Text>
            </View>
          )}

          {displayFacts.map(fact => {
            const st = statusMap[getStatus(fact)] || { bg: colors.textTertiary, label: t('common:verification.' + getStatus(fact), { defaultValue: getStatus(fact) }) };
            const name = getName(fact);
            return (
              <View key={fact.id} style={[s.card, shadow, { backgroundColor: colors.surface, padding: 14, marginBottom: 10 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[s.pill, { backgroundColor: st.bg, gap: 4 }]}>
                    <Ionicons name={st.icon || 'help-circle'} size={11} color="#fff" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{st.label}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{getTime(fact)}</Text>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginBottom: 10 }}>
                  {getTitle(fact)}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <View style={[s.avatarSm, { backgroundColor: colors.primary }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{typeof name === 'string' ? name[0] : '?'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>· {t('business:score', { count: getScore(fact) })}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <VoteButton itemId={fact.id} dir="up" type="fact" count={Math.max(fact.helpful_count ?? 0, 0)} />
                    <VoteButton itemId={fact.id} dir="down" type="fact" count={0} />
                  </View>
                </View>

                {fact.ownerResponse && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    <View style={{ borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Ionicons name="business" size={11} color={colors.primary} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>{t('business:ownerResponse')}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{fact.ownerResponse}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Actions */}
        <View style={{ gap: 10, marginVertical: 16 }}>
          <TouchableOpacity
            testID="business-write-review"
            style={[s.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/business/${id}/review`)}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t('business:actions.writeReview')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="business-report-fact"
            style={[s.actionBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }]}
            onPress={() => router.push(`/business/${id}/fact`)}
          >
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>{t('business:actions.reportFact')}</Text>
          </TouchableOpacity>
          {!!user && (
            <TouchableOpacity
              testID="business-claim-ownership"
              style={[s.actionBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.info ?? '#6366F1', flexDirection: 'row', gap: 8 }]}
              onPress={() => router.push(`/business/${id}/claim`)}
            >
              <Ionicons name="storefront-outline" size={18} color={colors.info ?? '#6366F1'} />
              <Text style={{ color: colors.info ?? '#6366F1', fontSize: 15, fontWeight: '600' }}>
                {t('business:actions.claimOwnership')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reviews */}
        <Text testID="business-reviews-section" style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12, letterSpacing: 0.3 }}>
          {t('business:sections.reviews')}
        </Text>

        {!dataLoading && displayReviews.length === 0 && (
          <View style={[s.card, shadow, { backgroundColor: colors.surface, padding: 16, alignItems: 'center' }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>{t('business:empty.noReviews')}</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('business:empty.noReviewsSubtitle')}</Text>
          </View>
        )}

        {displayReviews.map(review => {
          const name = getName(review);
          const expanded = expandedReviews[review.id];
          return (
            <View key={review.id} style={[s.card, shadow, { backgroundColor: colors.surface, padding: 14, marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[s.avatarSm, { backgroundColor: colors.primary }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{typeof name === 'string' ? name[0] : '?'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>· {t('business:score', { count: getScore(review) })}</Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{getTime(review)}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.starFilled, marginRight: 4 }}>{review.rating}.0</Text>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} filled={i <= review.rating} size={12} />
                ))}
              </View>

              <Text
                style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}
                numberOfLines={expanded ? undefined : 3}
              >
                {review.content}
              </Text>
              {!expanded && review.content?.length > 90 && (
                <TouchableOpacity onPress={() => setExpandedReviews(p => ({ ...p, [review.id]: true }))}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 4 }}>{t('business:readMore')}</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <VoteButton itemId={review.id} dir="up" type="review" count={Math.max(review.helpful_count ?? 0, 0)} />
                <VoteButton itemId={review.id} dir="down" type="review" count={0} />
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.info }]}>
          <Text style={{ color: colors.info, fontSize: 14, fontWeight: '600' }}>{t('business:actions.seeAllReviews')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, marginBottom: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  avatarSm: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  actionBtn: { borderRadius: 24, height: 48, alignItems: 'center', justifyContent: 'center' },
});
