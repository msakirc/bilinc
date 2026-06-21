import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { useAuthStore } from '@/src/store/auth';
import { DatabaseService } from '@/src/services/database';
import { formatDate } from '@/src/i18n/format';

type LocationState = 'idle' | 'requesting' | 'granted' | 'denied';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { categories } = useAppData();
  const { colors, isDark } = useTheme();
  const user = useAuthStore(s => s.user);

  const [tagsisFacts, setTagsisFacts] = useState<any[]>([]);
  const [nearbyListings, setNearbyListings] = useState<any[]>([]);
  const [popularListings, setPopularListings] = useState<any[]>([]);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const initDone = useRef(false);

  const loadHomeData = async () => {
    try {
      const tagsis = await DatabaseService.getTagsisFacts(5).catch(() => []);
      setTagsisFacts(tagsis);
    } catch {
      console.log('Home data unavailable');
    }
  };

  const loadPopularListings = async () => {
    try {
      const popular = await DatabaseService.getTrendingListings(5).catch(() => []);
      setPopularListings(popular);
    } catch {}
    setLocationLoaded(true);
  };

  const loadNearbyListings = async (lat: number, lon: number) => {
    try {
      const nearby = await DatabaseService.searchNearby({ latitude: lat, longitude: lon, radiusKm: 10, limit: 5 });
      setNearbyListings(nearby);
    } catch {
      await loadPopularListings();
    }
    setLocationLoaded(true);
  };

  const checkExistingPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationState('granted');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await loadNearbyListings(loc.coords.latitude, loc.coords.longitude);
      } else if (status === 'denied') {
        setLocationState('denied');
        await loadPopularListings();
      }
      // 'idle' stays for undetermined — show the prompt
    } catch {
      setLocationState('denied');
      await loadPopularListings();
    }
  };

  const requestLocationPermission = async () => {
    setLocationState('requesting');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationState('granted');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await loadNearbyListings(loc.coords.latitude, loc.coords.longitude);
      } else {
        setLocationState('denied');
        await loadPopularListings();
      }
    } catch {
      setLocationState('denied');
      await loadPopularListings();
    }
  };

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    loadHomeData();
    checkExistingPermission();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    if (locationState === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await loadNearbyListings(loc.coords.latitude, loc.coords.longitude);
      } catch {}
    } else if (locationState === 'denied') {
      await loadPopularListings();
    }
    setRefreshing(false);
  };

  const shadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: isDark ? 0.2 : 0.06, shadowRadius: 6, elevation: 2 };

  const reputationScore = user?.reputation_score ?? 0;
  const factThreshold = 100;
  const progress = Math.min(reputationScore / factThreshold, 1);
  const credibilityLabel =
    user?.credibility_level === 'contributor' ? t('common:credibility.contributor') :
    user?.credibility_level === 'trusted' ? t('common:credibility.trusted') :
    user?.credibility_level === 'expert' ? t('common:credibility.expert') : t('home:impact.credibilityNew');

  const listingsToShow = locationState === 'granted' ? nearbyListings : popularListings;
  const listingsTitle = locationState === 'granted' ? t('home:sections.nearbyBusinesses') : t('home:sections.popularBusinesses');

  // Deduplicate categories by slug
  const uniqueCategories = categories.filter((cat, idx, arr) =>
    arr.findIndex(c => c.slug === cat.slug) === idx
  );

  return (
    <ScrollView
      style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>

        {/* 1. Brand Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{'Bilinç'}</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* 2. Search Bar */}
        <TouchableOpacity
          style={[shadow, { backgroundColor: colors.input, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 14 }]}
          onPress={() => router.push('/(tabs)/search')}
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
          <Text style={{ fontSize: 15, color: colors.textTertiary }}>{t('home:searchPlaceholder')}</Text>
        </TouchableOpacity>

        {/* 3. Hero */}
        <View style={[shadow, { backgroundColor: colors.primary, borderRadius: 16, padding: 18, marginBottom: 18 }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 }}>
            {t('home:hero.title')}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19 }}>
            {t('home:hero.subtitle')}
          </Text>
        </View>

        {/* 4. Category Chips — compact pills */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{t('home:sections.categories')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>{t('common:actions.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {uniqueCategories.slice(0, 8).map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  onPress={() => router.push(`/category/${cat.slug}`)}
                >
                  <Ionicons name="grid-outline" size={13} color={colors.textTertiary} />
                  <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text }}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 5. Tağşiş — clickable, red-dominant cards */}
        {(tagsisFacts.length > 0) && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Ionicons name="warning" size={18} color="#EF4444" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{t('home:sections.foodSafetyWarnings')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Ionicons name="shield" size={10} color="#EF4444" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#EF4444' }}>{t('home:tagsis.officialData')}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 10 }}>
              {t('home:tagsis.source')}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10, paddingRight: 16 }}>
                {tagsisFacts.slice(0, 5).map((item: any) => {
                  const brand = item.brand || item.listing?.name || '';
                  const product = item.product || '';
                  const violation = item.violation || item.statement || '';
                  const province = item.province || '';
                  const date = item.date || (item.created_at ? formatDate(item.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '');
                  const listingId = item.listing_id || item.listing?.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      onPress={() => listingId ? router.push(`/business/${listingId}`) : null}
                      style={[shadow, {
                        backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
                        borderRadius: 12,
                        padding: 12,
                        width: 260,
                        borderLeftWidth: 4,
                        borderLeftColor: '#EF4444',
                      }]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FCA5A5' : '#991B1B', flex: 1 }} numberOfLines={1}>{brand}</Text>
                        <Text style={{ fontSize: 10, color: isDark ? '#FDA4AF' : '#9CA3AF', marginLeft: 8 }}>{date}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: isDark ? '#FECACA' : '#7F1D1D', marginBottom: 8 }} numberOfLines={1}>{product}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginTop: 1 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444', flex: 1, lineHeight: 18 }} numberOfLines={2}>{violation}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        {province ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="location-outline" size={12} color={isDark ? '#FDA4AF' : '#9CA3AF'} />
                            <Text style={{ fontSize: 11, color: isDark ? '#FDA4AF' : '#9CA3AF' }}>{province}</Text>
                          </View>
                        ) : <View />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Text style={{ fontSize: 10, color: isDark ? '#FCA5A5' : '#DC2626' }}>{t('home:tagsis.detail')}</Text>
                          <Ionicons name="chevron-forward" size={10} color={isDark ? '#FCA5A5' : '#DC2626'} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 6. Location section — nearby or popular businesses */}
        {locationState === 'idle' ? (
          <View style={[shadow, { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 20, alignItems: 'center' }]}>
            <Ionicons name="location-outline" size={28} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 4 }}>
              {t('home:location.title')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, marginBottom: 14 }}>
              {t('home:location.description')}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={requestLocationPermission}
            >
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('home:location.enable')}</Text>
            </TouchableOpacity>
          </View>
        ) : locationState === 'requesting' ? (
          <View style={[shadow, { backgroundColor: colors.surface, borderRadius: 16, padding: 24, marginBottom: 20, alignItems: 'center' }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={locationState === 'granted' ? 'navigate' : 'trending-up'} size={16} color={colors.primary} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{listingsTitle}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>{t('common:actions.seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {!locationLoaded ? (
              <View style={[shadow, { backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center' }]}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : listingsToShow.length > 0 ? listingsToShow.map((biz: any) => {
              const reviewCount = biz.total_reviews || 0;
              const categoryName = biz.category_name || '';
              return (
                <TouchableOpacity
                  key={biz.id}
                  style={[shadow, { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12 }]}
                  onPress={() => router.push(`/business/${biz.id}`)}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="storefront-outline" size={20} color={colors.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 }}>{biz.name}</Text>
                    {categoryName ? (
                      <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 3 }}>{categoryName}</Text>
                    ) : null}
                    {reviewCount > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="star" size={11} color={colors.starFilled} />
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{(biz.average_rating || 0).toFixed(1)} ({reviewCount})</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 11, color: colors.pending }}>{t('common:empty.notReviewed')}</Text>
                    )}
                  </View>
                  <View style={{ justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={[shadow, { backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center' }]}>
                <Ionicons name="storefront-outline" size={24} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 13, color: colors.textTertiary }}>{t('common:empty.noBusinesses')}</Text>
              </View>
            )}
          </View>
        )}

        {/* 7. Your Impact Card */}
        <View style={[shadow, { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{t('home:impact.title')}</Text>
          </View>

          {reputationScore === 0 ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
                {t('home:impact.emptyHeading')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 14 }}>
                {t('home:impact.emptyBody')}
              </Text>
            </>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.primary }}>{reputationScore}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('home:impact.points')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{credibilityLabel}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{t('home:impact.level')}</Text>
              </View>
            </View>
          )}

          {reputationScore < factThreshold && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{t('home:impact.forFactReporting')}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>{t('home:impact.pointsProgress', { current: reputationScore, threshold: factThreshold })}</Text>
              </View>
              <View style={{ height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.max(progress * 100, 2)}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10 }}
              onPress={() => router.push('/(tabs)/search')}
            >
              <Ionicons name="star-outline" size={16} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('home:impact.writeReview')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingVertical: 10 }}
              onPress={() => router.push('/(tabs)/search')}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.text} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{t('home:impact.writeFact')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 8. Bottom CTA — warm closer */}
        <View style={[shadow, { backgroundColor: isDark ? colors.surfaceSecondary : '#FFF7ED', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' }]}>
          <Ionicons name="people-outline" size={28} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 }}>
            {t('home:cta.title')}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 }}>
            {t('home:cta.body')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
