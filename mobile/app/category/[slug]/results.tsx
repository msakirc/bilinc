import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DatabaseService } from '@/src/services/database';
import { Category, SearchResult } from '@/src/types';
import { useAppData } from '@/src/contexts/AppDataContext';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatNumber } from '@/src/i18n/format';

export default function CategoryResultsScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { allCategories } = useAppData();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [sortBy, setSortBy] = useState<'most_reviewed' | 'top_rated'>('most_reviewed');

  // Get category from route params
  const categorySlug = slug || 'restaurants-food';

  useEffect(() => {
    // allCategories includes subcategories, so a sub-category slug resolves to
    // its real name + listing_count here.
    let category = allCategories.find(cat => cat.slug === categorySlug);

    // Slug not in the catalog (deep link / stale): build a minimal header from
    // the slug. No fabricated count — listing_count stays 0 and the count line
    // is hidden; the result list below still loads from the real backend.
    if (!category) {
      category = {
        id: 'temp-' + categorySlug,
        name: categorySlug.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        slug: categorySlug,
        icon: '📁',
        listing_count: 0,
        sort_order: 1,
        allowed_types: ['business']
      } as Category;
    }

    setSelectedCategory(category);
    loadResults(category.slug);
  }, [categorySlug, allCategories, sortBy]);

  const loadResults = async (slug: string) => {
    setLoading(true);
    try {
      const data = await DatabaseService.browseCategory({
        categorySlug: slug,
        sortBy: sortBy === 'most_reviewed' ? 'reviews' : 'rating',
        limit: 50,
      });
      setResults(data);
    } catch (error) {
      console.log('📂 Category results unavailable');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    router.push(`/business/${result.id}`);
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.surface }]}
      onPress={() => handleResultPress(item)}
    >
      <View style={styles.resultImage}>
        <Ionicons name="storefront-outline" size={36} color="#757575" />
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
                size={14}
                color={i < Math.floor(item.average_rating || 0) ? '#F59E0B' : '#D1D5DB'}
              />
            ))}
          </View>
          <Text style={styles.ratingNumber}>{item.average_rating?.toFixed(1) || '0.0'}</Text>
          <Text style={styles.reviewCount}>{t('category:result.reviewCount', { count: item.total_reviews || 0 })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!selectedCategory) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('category:loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      {/* Category Header */}
      <View style={[styles.categoryHeader, { backgroundColor: colors.surface }]}>
        <Text style={[styles.categoryTitle, { color: colors.text }]}>{selectedCategory.name}</Text>
        {!!selectedCategory.listing_count && (
          <Text style={styles.categoryCount}>
            {t('category:placeCount', { count: selectedCategory.listing_count, formattedCount: formatNumber(selectedCategory.listing_count) })}
          </Text>
        )}
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, { borderColor: colors.border }, sortBy === 'most_reviewed' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSortBy('most_reviewed')}
        >
          <Text style={[styles.sortButtonText, { color: colors.textSecondary }, sortBy === 'most_reviewed' && styles.sortButtonTextActive]}>
            {t('category:sort.mostReviewed')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, { borderColor: colors.border }, sortBy === 'top_rated' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => setSortBy('top_rated')}
        >
          <Text style={[styles.sortButtonText, { color: colors.textSecondary }, sortBy === 'top_rated' && styles.sortButtonTextActive]}>
            {t('category:sort.topRated')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('category:resultsLoading')}</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsList}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>{t('common:empty.noResults')}</Text>
          <Text style={styles.noResultsSubtext}>{t('category:empty.noResultsSubtitle')}</Text>
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
    paddingBottom: 80,
  },

  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'white',
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 16,
    color: '#757575',
  },

  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#1B4D3E',
    borderColor: '#1B4D3E',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  sortButtonTextActive: {
    color: 'white',
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
    backgroundColor: '#F5F3F0',
    color: '#4A4A4A',
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
