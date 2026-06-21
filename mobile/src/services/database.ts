import { supabase } from './supabase';
import { UserProfile, ListingStats, City, District, Category, EntityType } from '../types';
import {
  getListing as getCatalogListing,
  browseByCategory,
  browseByCityCategory,
  getRecentByType,
  getBrandProducts as dynamoBrandProducts,
  CatalogListingCard,
} from './dynamodb';
import {
  searchListings as tursoSearch,
  searchSuggestions as tursoSuggestions,
  searchNearby as geoNearby,
} from './search';

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Transform a DynamoDB CatalogListingCard to the snake_case format
 * that existing screens expect.
 */
function toEntityType(value: string): EntityType {
  return value === 'product' || value === 'brand' ? value : 'business';
}

function cardToLegacy(card: CatalogListingCard) {
  const primaryPhoto =
    card.photos?.find((p) => p.primary)?.url || card.photos?.[0]?.url;
  return {
    id: card.id,
    name: card.name,
    slug: card.slug,
    entity_type: toEntityType(card.entityType),
    city_code: card.cityCode,
    average_rating: card.rating,
    total_reviews: card.totalReviews,
    photo_url: primaryPhoto,
  };
}

export class DatabaseService {
  // ─── Cities and Districts (Supabase) ──────────────────────────────

  static async getCities(): Promise<City[]> {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  static async getDistricts(cityCode?: string): Promise<District[]> {
    let query = supabase
      .from('districts')
      .select('*')
      .order('name');

    if (cityCode) {
      query = query.eq('city_code', cityCode);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // ─── Categories (Supabase) ────────────────────────────────────────

  static async getCategories(parentId?: string): Promise<Category[]> {
    let query = supabase
      .from('categories')
      .select('*')
      .order('sort_order');

    if (parentId === null) {
      // Get root categories
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // ─── User Profile (Supabase) ─────────────────────────────────────

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .rpc('get_user_profile', { p_user_id: userId });

    if (error) throw error;
    return data?.[0] || null;
  }

  // ─── Listing Detail (DynamoDB) ────────────────────────────────────

  static async getListing(listingId: string) {
    const catalog = await getCatalogListing(listingId);
    if (!catalog) return null;

    // Transform to match existing screen expectations (snake_case)
    return {
      id: catalog.id,
      name: catalog.name,
      slug: catalog.slug,
      entity_type: catalog.entityType,
      status: catalog.status,
      description: catalog.description,
      city_code: catalog.cityCode,
      district_id: catalog.districtId,
      address_line: catalog.addressLine,
      latitude: catalog.latitude,
      longitude: catalog.longitude,
      average_rating: catalog.rating,
      total_reviews: catalog.totalReviews,
      source: catalog.source,
      parent_id: catalog.parentId,
      created_at: catalog.createdAt,
      updated_at: catalog.updatedAt,
      // Flatten embedded data to match screen expectations
      contacts: catalog.contacts,
      hours: catalog.hours,
      photos: catalog.photos,
      categories: catalog.categories,
      // Product-specific
      product_data: catalog.productData,
    };
  }

  // ─── Search (Turso FTS5 + DynamoDB browse) ────────────────────────

  static async searchListings({
    query,
    entityType,
    classification,
    cityCode,
    categorySlug,
    parentId,
    minRating,
    hasReviews,
    limit = 20,
    offset = 0,
  }: {
    query?: string;
    entityType?: string;
    classification?: string;
    cityCode?: string;
    categorySlug?: string;
    parentId?: string;
    minRating?: number;
    hasReviews?: boolean;
    limit?: number;
    offset?: number;
  }) {
    if (query) {
      // Text search → Turso FTS5
      const results = await tursoSearch(query, {
        cityCode,
        entityType,
        categorySlug,
        limit,
        offset,
      });
      return results.map((r) => ({
        id: r.id,
        name: r.name,
        entity_type: r.entityType,
        city_code: r.cityCode,
        category_slug: r.categorySlug,
        average_rating: r.rating,
        total_reviews: r.totalReviews,
        photo_url: r.photoUrl,
      }));
    }

    // No text query → DynamoDB category/city browse
    if (cityCode && categorySlug) {
      const result = await browseByCityCategory(cityCode, categorySlug, limit);
      return result.items.map(cardToLegacy);
    }

    if (categorySlug) {
      const result = await browseByCategory(categorySlug, limit);
      return result.items.map(cardToLegacy);
    }

    // Fallback: return empty for filter-only queries without category
    return [];
  }

  // Nearby search — Turso geo via the search proxy (catalog left Supabase).
  static async searchNearby({
    latitude,
    longitude,
    radiusKm = 5,
    categorySlug,
    entityType,
    minRating,
    limit = 20,
  }: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    categorySlug?: string;
    entityType?: string;
    classification?: string;
    parentId?: string;
    minRating?: number;
    limit?: number;
    offset?: number;
  }) {
    const results = await geoNearby(latitude, longitude, {
      radiusKm,
      categorySlug,
      entityType,
      limit,
    });
    return results
      .filter((r) => minRating == null || r.rating >= minRating)
      .map((r) => ({
        id: r.id,
        name: r.name,
        entity_type: r.entityType,
        city_code: r.cityCode,
        category_slug: r.categorySlug,
        average_rating: r.rating,
        total_reviews: r.totalReviews,
        latitude: r.latitude,
        longitude: r.longitude,
        photo_url: r.photoUrl,
        distance_km: r.distanceKm,
      }));
  }

  // Search suggestions (Turso FTS5 prefix match)
  static async getSearchSuggestions(query: string, limit = 10) {
    const results = await tursoSuggestions(query, limit);
    return results.map((r) => ({
      id: r.id,
      name: r.name,
      entity_type: r.entityType,
      category_slug: r.categorySlug,
    }));
  }

  // Browse by category (DynamoDB)
  static async browseCategory({
    categorySlug,
    entityType,
    classification,
    cityCode,
    minRating,
    sortBy = 'rating',
    limit = 20,
    offset = 0,
  }: {
    categorySlug: string;
    entityType?: string;
    classification?: string;
    cityCode?: string;
    minRating?: number;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }) {
    if (cityCode) {
      const result = await browseByCityCategory(cityCode, categorySlug, limit);
      return result.items.map(cardToLegacy);
    }

    const result = await browseByCategory(categorySlug, limit);
    return result.items.map(cardToLegacy);
  }

  // Get categories for entity type (Supabase)
  static async getCategoriesForType(entityType: string, parentOnly = false) {
    const { data, error } = await supabase.rpc('get_categories_for_type', {
      p_entity_type: entityType,
      p_parent_only: parentOnly,
    });

    if (error) throw error;
    return data || [];
  }

  // Company overview (DynamoDB — get item + children via GSI4)
  static async getCompanyOverview(companyId: string) {
    const company = await getCatalogListing(companyId);
    if (!company) return null;
    const children = await dynamoBrandProducts(companyId);
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      entity_type: company.entityType,
      average_rating: company.rating,
      total_reviews: company.totalReviews,
      children: children.map(cardToLegacy),
    };
  }

  // Brand products (DynamoDB GSI4)
  static async getBrandProducts(brandId: string) {
    const items = await dynamoBrandProducts(brandId);
    return items.map(cardToLegacy);
  }

  // Company branches (DynamoDB GSI4 — children filtered to businesses)
  static async getCompanyBranches(companyId: string, cityCode?: string) {
    const children = await dynamoBrandProducts(companyId);
    return children
      .filter((c) => c.entityType === 'business')
      .filter((c) => !cityCode || c.cityCode === cityCode)
      .map(cardToLegacy);
  }

  // Get listing breadcrumb (DynamoDB — walk the parentId chain root→current)
  static async getListingBreadcrumb(listingId: string) {
    const chain: Array<{ id: string; name: string; slug: string; entity_type: string }> = [];
    let currentId: string | undefined = listingId;
    let guard = 0;
    while (currentId && guard < 5) {
      const node = await getCatalogListing(currentId);
      if (!node) break;
      chain.unshift({
        id: node.id,
        name: node.name,
        slug: node.slug,
        entity_type: node.entityType,
      });
      currentId = node.parentId;
      guard += 1;
    }
    return chain;
  }

  static async getListingStats(listingId: string): Promise<ListingStats | null> {
    const { data, error } = await supabase
      .rpc('get_listing_stats', { p_listing_id: listingId });

    if (error) throw error;
    return data?.[0] || null;
  }

  // ─── Security Questions (Supabase) ───────────────────────────────

  static async setSecurityQuestions(
    question1: string,
    answer1: string,
    question2: string,
    answer2: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('set_security_questions', {
      p_question_1: question1,
      p_answer_1: answer1,
      p_question_2: question2,
      p_answer_2: answer2,
    });

    if (error) throw error;
    return data;
  }

  static async getSecurityQuestions(username: string): Promise<{question_1: string, question_2: string} | null> {
    const { data, error } = await supabase.rpc('get_security_questions', {
      p_username: username,
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  static async verifySecurityAnswers(
    username: string,
    answer1: string,
    answer2: string
  ): Promise<{success: boolean, message: string, reset_token?: string}> {
    const { data, error } = await supabase.rpc('verify_security_answers', {
      p_username: username,
      p_answer_1: answer1,
      p_answer_2: answer2,
    });

    if (error) throw error;
    return data?.[0] || { success: false, message: 'Verification failed' };
  }

  // ─── Utility (Supabase) ──────────────────────────────────────────

  static async refreshMaterializedViews(): Promise<void> {
    const { error } = await supabase.rpc('refresh_materialized_views');
    if (error) throw error;
  }

  // ─── Facts & Reviews (Supabase — unchanged) ──────────────────────

  static async getListingFacts(listingId: string, limit = 10) {
    const { data, error } = await supabase
      .from('facts')
      .select(`
        *,
        user:users!facts_user_id_fkey(username, reputation_score, credibility_level)
      `)
      .eq('listing_id', listingId)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async getListingReviews(listingId: string, limit = 10) {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        user:users!reviews_user_id_fkey(username, reputation_score, credibility_level)
      `)
      .eq('listing_id', listingId)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async submitReview({
    listingId,
    rating,
    title,
    content,
  }: {
    listingId: string;
    rating: number;
    title?: string;
    content: string;
  }) {
    // reviews RLS requires auth.uid() = user_id, and the column has no default,
    // so set it explicitly. Use the local session (getSession is offline and
    // reliable; getUser does a network round-trip that can fail on RN).
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        listing_id: listingId,
        rating,
        title,
        content,
        user_id: session?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Fact Checks (community verify/dispute/needs_evidence, Supabase) ─

  /**
   * Submit or update a community fact check vote for the current user.
   * One vote per user per fact (upserts on conflict fact_id,user_id).
   * RLS ensures only authenticated users can insert, one row per fact per user.
   * UI wiring (verify/dispute buttons) is separate from this service method.
   */
  static async submitFactCheck({
    factId,
    vote,
    comment,
    evidenceUrl,
  }: {
    factId: string;
    vote: 'verify' | 'dispute' | 'needs_evidence';
    comment?: string;
    evidenceUrl?: string;
  }) {
    // fact_checks RLS requires auth.uid() = user_id, no column default -> set it.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const payload: Record<string, any> = {
      fact_id: factId,
      vote,
      user_id: session?.user?.id,
    };
    if (comment !== undefined) payload.comment = comment;
    if (evidenceUrl !== undefined) payload.evidence_url = evidenceUrl;

    const { data, error } = await supabase
      .from('fact_checks')
      .upsert(payload, { onConflict: 'fact_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async submitFact({
    listingId,
    statement,
    category,
    truthGuarantee = true,
  }: {
    listingId: string;
    statement: string;
    category: string;
    truthGuarantee?: boolean;
  }) {
    // facts RLS requires auth.uid() = user_id, and the column has no default,
    // so set it explicitly (same fix as submitReview). getSession is offline
    // and reliable; getUser does a network round-trip that can fail on RN.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const { data, error } = await supabase
      .from('facts')
      .insert({
        listing_id: listingId,
        statement,
        category,
        truth_guarantee: truthGuarantee,
        verification_status: 'pending',
        user_id: session?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── Home Page Listings (DynamoDB) ────────────────────────────────

  static async getTrendingListings(limit = 5) {
    // Use recently added businesses with reviews, sorted by review count
    // TODO: add a TRENDING GSI or precomputed top-N for production
    const items = await getRecentByType('business', limit * 3);
    return items
      .filter((i) => i.totalReviews > 0)
      .sort((a, b) => b.totalReviews - a.totalReviews)
      .slice(0, limit)
      .map(cardToLegacy);
  }

  static async getRecentlyAddedListings(limit = 5) {
    const items = await getRecentByType('business', limit);
    return items.map(cardToLegacy);
  }

  // ─── Verified Facts & Tağşiş (Supabase — unchanged) ──────────────

  static async getRecentVerifiedFacts(limit = 5) {
    const { data, error } = await supabase
      .from('facts')
      .select(`
        *,
        user:users!facts_user_id_fkey(username, reputation_score, credibility_level),
        listing:listings!facts_listing_id_fkey(name, slug)
      `)
      .eq('verification_status', 'verified')
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ─── User Activity (Supabase — FK join, matches web) ─────────────
  // Use the listings FK join (same as web) rather than denormalized
  // listing_name/listing_slug columns, which may not exist in the schema.
  // The join already returns `listing: { name, slug }` in the shape screens expect.

  static async getUserReviews(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, listing:listings!reviews_listing_id_fkey(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async getUserFacts(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('facts')
      .select('*, listing:listings!facts_listing_id_fkey(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ─── User Stats (Supabase — unchanged) ───────────────────────────

  static async getUserStats(userId: string) {
    // get_user_profile aggregates counts + helpful votes + verified facts in one RPC.
    const profile = (await this.getUserProfile(userId)) as any;
    if (!profile) {
      return { totalReviews: 0, totalFacts: 0, helpfulVotes: 0, factVerificationRate: 0 };
    }

    const totalFacts = Number(profile.total_facts) || 0;
    const verifiedFacts = Number(profile.verified_facts) || 0;

    return {
      totalReviews: Number(profile.total_reviews) || 0,
      totalFacts,
      helpfulVotes: Number(profile.helpful_votes_received) || 0,
      factVerificationRate: totalFacts ? Math.round((verifiedFacts / totalFacts) * 100) : 0,
    };
  }

  // ─── Voting (Supabase — unchanged) ───────────────────────────────

  static async voteOnReview(reviewId: string, voteType: 'helpful' | 'not_helpful') {
    // review_votes RLS requires auth.uid() = user_id, no column default -> set it.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const { data, error } = await supabase
      .from('review_votes')
      .upsert({
        review_id: reviewId,
        vote_type: voteType,
        user_id: session?.user?.id,
      }, { onConflict: 'review_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async voteOnFact(factId: string, voteType: 'helpful' | 'not_helpful') {
    // fact_votes RLS requires auth.uid() = user_id, no column default -> set it.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const { data, error } = await supabase
      .from('fact_votes')
      .upsert({
        fact_id: factId,
        vote_type: voteType,
        user_id: session?.user?.id,
      }, { onConflict: 'fact_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteReviewVote(reviewId: string) {
    const { error } = await supabase
      .from('review_votes')
      .delete()
      .eq('review_id', reviewId);

    if (error) throw error;
  }

  static async deleteFactVote(factId: string) {
    const { error } = await supabase
      .from('fact_votes')
      .delete()
      .eq('fact_id', factId);

    if (error) throw error;
  }

  // ─── Delete (Supabase — unchanged) ───────────────────────────────

  static async deleteReview(reviewId: string) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
  }

  static async deleteFact(factId: string) {
    const { error } = await supabase
      .from('facts')
      .delete()
      .eq('id', factId);

    if (error) throw error;
  }

  // ─── Image Upload (Supabase Storage — unchanged) ─────────────────

  static async uploadImage(uri: string, bucket: string, path: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${path}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  static async uploadReviewPhotos(reviewId: string, imageUris: string[]): Promise<void> {
    for (let i = 0; i < imageUris.length; i++) {
      try {
        const url = await this.uploadImage(imageUris[i], 'review-photos', `reviews/${reviewId}`);
        await supabase.from('review_photos').insert({
          review_id: reviewId,
          url,
          sort_order: i,
        });
      } catch (error) {
        console.error(`Failed to upload photo ${i + 1}:`, error);
        // Continue with remaining photos
      }
    }
  }

  // ─── Listing Claims (Supabase) ────────────────────────────────────

  /**
   * Create a new listing ownership claim.
   * RLS policy (listing_claims_insert_self) requires status='pending'.
   * Returns the new claim id.
   */
  static async createClaim(params: {
    listingId: string;
    userId: string;
    role: 'owner' | 'manager' | 'employee';
    verificationMethod: 'video';
    taxNumber: string;
    consentAt: string;
    capturedLat?: number;
    capturedLng?: number;
    livenessNonce?: string;
  }): Promise<string> {
    const payload: Record<string, any> = {
      listing_id: params.listingId,
      user_id: params.userId,
      role: params.role,
      status: 'pending',
      verification_method: params.verificationMethod,
      tax_number: params.taxNumber,
      consent_at: params.consentAt,
    };
    if (params.capturedLat !== undefined) payload.captured_lat = params.capturedLat;
    if (params.capturedLng !== undefined) payload.captured_lng = params.capturedLng;
    if (params.livenessNonce !== undefined) payload.liveness_nonce = params.livenessNonce;

    const { data, error } = await supabase
      .from('listing_claims')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Upload a local video file to the private bilinc-verification bucket.
   * Uses fetch → blob (React Native compatible) then Supabase storage upload.
   * After upload, updates the claim row with the storage path.
   * Returns the storage path.
   */
  static async uploadVerificationVideo(
    userId: string,
    claimId: string,
    fileUri: string
  ): Promise<string> {
    const path = `${userId}/${claimId}/video.mp4`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('bilinc-verification')
      .upload(path, blob, { contentType: 'video/mp4', upsert: true });

    if (uploadError) throw uploadError;

    // Update claim row with the storage path
    await supabase
      .from('listing_claims')
      .update({ verification_document_url: path })
      .eq('id', claimId);

    return path;
  }

  // ─── Tağşiş Facts (Supabase — unchanged) ─────────────────────────

  static async getTagsisFacts(limit = 10) {
    const { data, error } = await supabase
      .from('facts')
      .select(`
        *,
        listing:listings!facts_listing_id_fkey(name, slug)
      `)
      .eq('category', 'safety')
      .eq('verification_status', 'verified')
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ─── Utility ─────────────────────────────────────────────────────

  static generateSlug(text: string): string {
    // This matches the database function logic.
    // IMPORTANT: İ (U+0130) must be replaced BEFORE .toLowerCase() because
    // JS toLowerCase() converts İ → "i" + U+0307 (combining dot above), which
    // then becomes a stray dash when non-alphanumeric chars are stripped.
    return text
      .replace(/İ/g, 'i')
      .toLowerCase()
      .trim()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }
}
