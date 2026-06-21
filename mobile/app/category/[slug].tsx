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

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { categories, getSubcategories, categoriesLoaded } = useAppData();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [featuredResults, setFeaturedResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const categorySlug = slug || 'restaurants-food';

  useEffect(() => {
    const loadCategoryData = async () => {
      setLoading(true);

      // Find the selected category
      const category = categories.find(cat => cat.slug === categorySlug);
      if (category) {
        setSelectedCategory(category);

        // Get sub-categories from pre-loaded context data
        const subs = getSubcategories(category.id);
        console.log('Loaded sub-categories from context:', subs.length);

        setSubCategories(subs && subs.length > 0 ? subs : []);

        try {
          // Load featured results (top rated) - this still requires an API call
          const results = await DatabaseService.browseCategory({
            categorySlug: category.slug,
            sortBy: 'rating',
            limit: 6,
          });
          setFeaturedResults(results);
        } catch (error) {
          console.log('📂 Featured results unavailable');
          setFeaturedResults([]);
        }
      }

      setLoading(false);
    };

    // Only load when categories are available
    if (categoriesLoaded) {
      loadCategoryData();
    }
  }, [categorySlug, categories, categoriesLoaded]);

  const handleSubCategoryPress = (subCategory: Category) => {
    router.push(`/category/${subCategory.slug}/results`);
  };

  const handleFeaturedResultPress = (result: SearchResult) => {
    router.push(`/business/${result.id}`);
  };

  const handleSeeAllResults = () => {
    if (selectedCategory) {
      router.push(`/category/${selectedCategory.slug}/results`);
    }
  };

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
        <View style={styles.categoryIcon}>
          {selectedCategory.icon
            ? <Text style={styles.categoryIconText}>{selectedCategory.icon}</Text>
            : <Ionicons name="folder-outline" size={32} color="#757575" />
          }
        </View>
        <Text style={[styles.categoryTitle, { color: colors.text }]}>{selectedCategory.name}</Text>
        <Text style={styles.categoryCount}>
          {t('category:placeCount', { count: selectedCategory.listing_count || 0, formattedCount: formatNumber(selectedCategory.listing_count || 0) })}
        </Text>
        <Text style={styles.categoryDescription}>
          {t('category:detail.description')}
        </Text>
      </View>

      {/* Sub-Categories */}
      {subCategories.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('category:detail.subCategories')}</Text>
          <View style={styles.subCategoriesGrid}>
            {subCategories.map((subCategory) => (
              <TouchableOpacity
                key={subCategory.id}
                style={[styles.subCategoryCard, { backgroundColor: colors.surface }]}
                onPress={() => handleSubCategoryPress(subCategory)}
              >
                <View style={styles.subCategoryIcon}>
                  {subCategory.icon
                    ? <Text style={styles.subCategoryIconText}>{subCategory.icon}</Text>
                    : <Ionicons name="folder-outline" size={20} color="#757575" />
                  }
                </View>
                <Text style={[styles.subCategoryName, { color: colors.text }]}>{subCategory.name}</Text>
                <Text style={styles.subCategoryCount}>
                  {t('category:placeCount', { count: subCategory.listing_count || 0, formattedCount: formatNumber(subCategory.listing_count || 0) })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Featured Results */}
      {featuredResults.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('category:detail.topRated', { name: selectedCategory.name })}</Text>
          <View style={styles.featuredResults}>
            {featuredResults.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={[styles.featuredCard, { backgroundColor: colors.surface }]}
                onPress={() => handleFeaturedResultPress(result)}
              >
                <View style={styles.featuredImage}>
                  <Ionicons name="storefront-outline" size={28} color="#757575" />
                </View>
                <View style={styles.featuredContent}>
                  <Text style={[styles.featuredName, { color: colors.text }]}>{result.name}</Text>
                  <View style={styles.featuredRating}>
                    <View style={styles.stars}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Ionicons
                          key={i}
                          name={i < Math.floor(result.average_rating || 0) ? 'star' : 'star-outline'}
                          size={12}
                          color={i < Math.floor(result.average_rating || 0) ? '#F59E0B' : '#D1D5DB'}
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingNumber}>{result.average_rating?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.reviewCount}>({result.total_reviews || 0})</Text>
                  </View>
                  <Text style={styles.featuredFact}>{t('category:detail.topRatedFact')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* See All Results Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAllResults}>
          <Text style={styles.seeAllButtonText}>{t('category:detail.seeAllResults')}</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 24,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F3F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  categoryIconText: {
    fontSize: 32,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryCount: {
    fontSize: 16,
    color: '#1B4D3E',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },

  section: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },

  subCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subCategoryCard: {
    width: '48%', // 2 columns
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  subCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subCategoryIconText: {
    fontSize: 20,
  },
  subCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subCategoryCount: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
  },

  featuredResults: {
    gap: 12,
  },
  featuredCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  featuredImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featuredImagePlaceholder: {
    fontSize: 24,
  },
  featuredContent: {
    flex: 1,
  },
  featuredName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 12,
    color: '#E5E5E5',
  },
  starFilled: {
    color: '#F59E0B',
  },
  ratingNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#757575',
  },
  featuredFact: {
    fontSize: 12,
    color: '#4A4A4A',
  },

  actionSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  seeAllButton: {
    backgroundColor: '#1B4D3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  seeAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
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
});
