import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DatabaseService } from '@/src/services/database';
import { Category, SearchResult } from '@/src/types';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatNumber } from '@/src/i18n/format';

const RECENT_SEARCHES_KEY = 'recent_searches';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories } = useAppData();
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Dynamic styles that depend on insets
  const dynamicStyles = {
    scrollView: {
      paddingTop: insets.top + 16,
    },
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'most_reviewed' | 'top_rated'>('most_reviewed');



  // Load recent searches on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (error) {
        console.log('Recent searches unavailable');
      }
    };

    loadRecentSearches();
  }, []);

  // Handle search input changes
  useEffect(() => {
    const handleSearchChange = async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        let results: any[] = [];
        try {
          results = await DatabaseService.searchListings({ query: searchQuery, limit: 20 });
        } catch (error) {
          console.log('📂 Search unavailable');
        }

        setSearchResults(results);
        if (results.length > 0) {
          saveRecentSearch(searchQuery);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(handleSearchChange, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleRecentSearchPress = (search: string) => {
    setSearchQuery(search);
    // Save to recent searches when clicked
    saveRecentSearch(search);
  };

  const handlePopularSearchPress = (search: string) => {
    setSearchQuery(search);
  };

  const handleCategoryPress = (category: Category) => {
    // Navigate to category detail screen to show sub-categories
    router.push(`/category/${category.slug}`);
  };

  const handleResultPress = (result: SearchResult) => {
    router.push(`/business/${result.id}`);
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.log('Could not save recent search');
    }
  };

  const removeRecentSearch = async (index: number) => {
    try {
      const updated = recentSearches.filter((_, i) => i !== index);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.log('Could not remove recent search');
    }
  };

  const formatCount = (count?: number): string | null => {
    if (!count || count <= 0) return null;
    return formatNumber(count);
  };

  const sortedResults = [...searchResults].sort((a, b) => {
    if (sortBy === 'top_rated') {
      return (b.average_rating || 0) - (a.average_rating || 0);
    }
    // most_reviewed (default)
    return (b.total_reviews || 0) - (a.total_reviews || 0);
  });

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      testID={`search-result-${item.id}`}
      style={[styles.resultCard, { backgroundColor: colors.surface }]}
      onPress={() => handleResultPress(item)}
    >
      <View style={styles.resultImage}>
        <Ionicons name="storefront-outline" size={24} color={colors.textTertiary} />
      </View>

      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
          <Text style={styles.resultDistance}>0.2 km</Text>
        </View>

        <View style={styles.resultTags}>
          <Text style={styles.resultTag}>{item.category_name || t('common:entityType.business')}</Text>
          <Text style={styles.resultTag}>{item.classification || 'bağımsız'}</Text>
        </View>

        <View style={styles.resultRating}>
          <View style={styles.stars}>
            {Array.from({ length: 5 }, (_, i) => (
              <Ionicons
                key={i}
                name={i < Math.floor(item.average_rating || 0) ? 'star' : 'star-outline'}
                size={13}
                color={i < Math.floor(item.average_rating || 0) ? colors.starFilled : colors.textTertiary}
              />
            ))}
          </View>
          <Text style={styles.ratingNumber}>{item.average_rating?.toFixed(1) || '0.0'}</Text>
          <Text style={styles.reviewCount}>{t('search:result.reviewCount', { count: item.total_reviews || 0 })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.scrollView, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: colors.input }]}>
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
          </View>
          <TextInput
            testID="search-input"
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('search:placeholder')}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
        </View>
      </View>

      {/* Content */}
      {searchQuery.length >= 2 ? (
        // Search Results
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={[styles.resultsTitle, { color: colors.text }]}>{t('search:resultsFor', { query: searchQuery })}</Text>
            <Text style={styles.resultsCount}>{t('search:resultCount', { count: searchResults.length })}</Text>
          </View>

          {/* Sort Bar */}
          <View style={styles.sortBar}>
            <TouchableOpacity
              testID="search-sort-most-reviewed"
              style={[styles.sortButton, { backgroundColor: colors.input }, sortBy === 'most_reviewed' && { backgroundColor: colors.primary }]}
              onPress={() => setSortBy('most_reviewed')}
            >
              <Text style={[styles.sortButtonText, { color: colors.textSecondary }, sortBy === 'most_reviewed' && styles.sortButtonTextActive]}>
                {t('search:sort.mostReviewed')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="search-sort-top-rated"
              style={[styles.sortButton, { backgroundColor: colors.input }, sortBy === 'top_rated' && { backgroundColor: colors.primary }]}
              onPress={() => setSortBy('top_rated')}
            >
              <Text style={[styles.sortButtonText, { color: colors.textSecondary }, sortBy === 'top_rated' && styles.sortButtonTextActive]}>
                {t('search:sort.topRated')}
              </Text>
            </TouchableOpacity>
          </View>

          {isSearching ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{t('search:status.searching')}</Text>
            </View>
          ) : sortedResults.length > 0 ? (
            <FlatList
              data={sortedResults}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>{t('common:empty.noResults')}</Text>
              <Text style={styles.noResultsSubtext}>{t('search:empty.noResultsSubtitle')}</Text>
            </View>
          )}
        </View>
      ) : (
        // Browse View
        <View style={styles.browseContainer}>
          {/* Recently Searched — only show if there are searches */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('search:browse.recentSearches')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentSearchesScroll}>
                <View style={styles.recentSearchesContainer}>
                  {recentSearches.map((search, index) => (
                    <View key={index} style={[styles.recentSearchPill, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.recentSearchText, { color: colors.textSecondary }]}>{search}</Text>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeRecentSearch(index)}
                      >
                        <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Browse Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('search:browse.browseCategories')}</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryCard, { backgroundColor: colors.surface }]}
                  onPress={() => handleCategoryPress(category)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: colors.surfaceSecondary }]}>
                    {category.icon && category.icon !== '📁' ? (
                      <Text style={styles.categoryIconText}>{category.icon}</Text>
                    ) : (
                      <Ionicons name="grid-outline" size={20} color={colors.textTertiary} />
                    )}
                  </View>
                  <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                   {formatCount(category.listing_count) && (
                     <Text style={[styles.categoryCount, { color: colors.textTertiary }]}>
                       {t('category:placeCount', { count: category.listing_count || 0, formattedCount: formatCount(category.listing_count) })}
                     </Text>
                   )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Popular Right Now */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('search:browse.popularNow')}</Text>
            <View style={styles.popularSearches}>
              {[
                t('search:popular.pizzaNearby'),
                t('search:popular.pharmacyHours'),
                t('search:popular.oilChange'),
                t('search:popular.bestCoffee'),
                t('search:popular.winterTires'),
              ].map((name, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularSearchItem}
                  onPress={() => handlePopularSearchPress(name)}
                >
                  <View style={styles.popularSearchIcon}>
                    <Ionicons name="search" size={14} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.popularSearchText, { color: colors.text }]}>{name}</Text>
                  <View style={styles.trendingIcon}>
                    <Ionicons name="trending-up" size={16} color={colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Ad Space */}
          <View style={styles.section}>
            <View style={[styles.adCard, { backgroundColor: colors.surface }]}>
              <View style={styles.adContent}>
                <Text style={[styles.adTitle, { color: colors.text }]}>LocalExplorer - Find Hidden Gems</Text>
                <Text style={styles.adDescription}>Discover verified local businesses and services</Text>
                <TouchableOpacity style={styles.adButton}>
                  <Text style={styles.adButtonText}>Download</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.adLabel}>Ad</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  contentContainer: {
    paddingBottom: 32,
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EDE8',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 44,
    gap: 8,
  },
  searchIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconText: {
    fontSize: 14,
    color: '#757575',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 0,
  },

  // Results Container
  resultsContainer: {
    minHeight: 400,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  resultsCount: {
    fontSize: 14,
    color: '#757575',
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  resultImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImagePlaceholder: {
    fontSize: 32,
  },
  resultContent: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  resultDistance: {
    fontSize: 12,
    color: '#757575',
  },
  resultTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  resultTag: {
    backgroundColor: '#F0EDE8',
    color: '#4A4A4A', // Overridden inline where needed
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 14,
    color: '#E5E5E5',
  },
  starFilled: {
    color: '#F59E0B',
  },
  ratingNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 14,
    color: '#757575',
  },

  // Browse Container
  browseContainer: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },

  // Recent Searches
  recentSearchesScroll: {
    marginHorizontal: -16,
  },
  recentSearchesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  recentSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  recentSearchText: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  removeButton: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    fontSize: 12,
    color: '#757575',
  },

  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '48%', // 2 columns with gap
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F3F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryIconText: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },

  // Popular Searches
  popularSearches: {
    gap: 12,
  },
  popularSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 0,
    gap: 12,
  },
  popularSearchIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularSearchIconText: {
    fontSize: 14,
    color: '#757575',
  },
  popularSearchText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  trendingIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingIconText: {
    fontSize: 14,
    color: '#F59E0B',
  },

  // Ad Card
  adCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  adTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  adDescription: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    marginBottom: 8,
    flex: 1,
  },
  adButton: {
    backgroundColor: '#1B4D3E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  adButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  adLabel: {
    fontSize: 12,
    color: '#A3A3A3',
    alignSelf: 'flex-end',
    marginTop: 8,
  },

  // Sort Bar
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0EDE8',
  },
  sortButtonActive: {
    backgroundColor: '#1B4D3E',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  sortButtonTextActive: {
    color: 'white',
  },

  // Loading/No Results
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#757575',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
});
