import { createClient } from "./supabase/client";
import type {
  UserProfile,
  ListingStats,
  City,
  District,
  Category,
  AdminStats,
  SearchResult,
  SearchSuggestion,
  Listing,
} from "./types";

function getClient() {
  return createClient();
}

export class DatabaseService {
  // === Reference Data ===

  static async getCities(): Promise<City[]> {
    const supabase = getClient();
    const { data, error } = await supabase.from("cities").select("*").order("name");
    if (error) throw error;
    return data || [];
  }

  static async getDistricts(cityCode?: string): Promise<District[]> {
    const supabase = getClient();
    let query = supabase.from("districts").select("*").order("name");
    if (cityCode) query = query.eq("city_code", cityCode);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async getCategories(parentId?: string | null): Promise<Category[]> {
    const supabase = getClient();
    let query = supabase.from("categories").select("*").order("sort_order");
    if (parentId === null) query = query.is("parent_id", null);
    else if (parentId) query = query.eq("parent_id", parentId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async getCategoryTree() {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_category_tree");
    if (error) throw error;
    return data || [];
  }

  // Categories for an entity type (matches mobile DatabaseService.getCategoriesForType).
  static async getCategoriesForType(entityType: string, parentOnly = false) {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_categories_for_type", {
      p_entity_type: entityType,
      p_parent_only: parentOnly,
    });
    if (error) throw error;
    return data || [];
  }

  // === User ===

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_user_profile", { p_user_id: userId });
    if (error) throw error;
    return data?.[0] || null;
  }

  static async getUserByUsername(username: string) {
    const supabase = getClient();
    const { data, error } = await supabase.from("users").select("*").eq("username", username).single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // === Search ===

  static async searchListings(params: {
    query?: string; entityType?: string; classification?: string;
    cityCode?: string; categorySlug?: string; parentId?: string;
    minRating?: number; hasReviews?: boolean; limit?: number; offset?: number;
  }): Promise<SearchResult[]> {
    // Served by the server-side route handler (AWS SDK stays off the client).
    // classification / parentId / minRating / hasReviews are not supported by
    // the proxy and are ignored.
    const res = await fetch("/api/catalog/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        cityCode: params.cityCode,
        entityType: params.entityType,
        categorySlug: params.categorySlug,
        limit: params.limit,
        offset: params.offset,
      }),
    });
    if (!res.ok) return [];
    return res.json();
  }

  static async getSearchSuggestions(query: string, limit = 10): Promise<SearchSuggestion[]> {
    // Served by the server-side route handler (was direct search proxy).
    const res = await fetch("/api/catalog/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return [];
    return res.json();
  }

  static async browseCategory(params: {
    categorySlug: string; entityType?: string; classification?: string;
    cityCode?: string; minRating?: number; sortBy?: string; limit?: number; offset?: number;
  }): Promise<SearchResult[]> {
    // Served by the server-side route handler (was direct DynamoDB catalog). The
    // catalog layer has no offset/sortBy/entityType/classification/minRating
    // filters, so those params are ignored (results come pre-sorted by rating).
    const res = await fetch("/api/catalog/browse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categorySlug: params.categorySlug,
        cityCode: params.cityCode,
        limit: params.limit,
      }),
    });
    if (!res.ok) return [];
    return res.json();
  }

  // === Listing Detail ===

  static async getListing(listingId: string): Promise<Listing> {
    // Served by the server-side route handler (was direct DynamoDB catalog).
    // Preserves the old contract: throws when the listing isn't found.
    const res = await fetch(`/api/catalog/listing/${listingId}`);
    if (res.status === 404) throw new Error(`Listing not found: ${listingId}`);
    const listing = await res.json();
    if (!listing) throw new Error(`Listing not found: ${listingId}`);
    return listing;
  }

  static async getListingStats(listingId: string): Promise<ListingStats | null> {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_listing_stats", { p_listing_id: listingId });
    if (error) throw error;
    return data?.[0] || null;
  }

  static async getListingFacts(listingId: string, limit = 10) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username, reputation_score, credibility_level)")
      .eq("listing_id", listingId).eq("is_flagged", false)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async getListingReviews(listingId: string, limit = 10) {
    const supabase = getClient();
    const { data, error } = await supabase.from("reviews")
      .select("*, user:users!reviews_user_id_fkey(username, reputation_score, credibility_level)")
      .eq("listing_id", listingId).eq("is_flagged", false)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  // === Consumer Actions ===

  static async submitReview(params: { listingId: string; rating: number; title?: string; content: string }) {
    const supabase = getClient();
    // RLS requires auth.uid() = user_id and the column has no default, so set it
    // explicitly rather than relying on RLS to backfill (matches mobile).
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("reviews")
      .insert({ listing_id: params.listingId, rating: params.rating, title: params.title, content: params.content, user_id: session?.user?.id })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async submitFact(params: { listingId: string; statement: string; category: string; truthGuarantee?: boolean }) {
    const supabase = getClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("facts")
      .insert({ listing_id: params.listingId, statement: params.statement, category: params.category,
        truth_guarantee: params.truthGuarantee ?? true, verification_status: "pending", user_id: session?.user?.id })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async voteOnReview(reviewId: string, voteType: "helpful" | "not_helpful") {
    const supabase = getClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("review_votes")
      .upsert({ review_id: reviewId, vote_type: voteType, user_id: session?.user?.id }, { onConflict: "review_id,user_id" })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async voteOnFact(factId: string, voteType: "helpful" | "not_helpful") {
    const supabase = getClient();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("fact_votes")
      .upsert({ fact_id: factId, vote_type: voteType, user_id: session?.user?.id }, { onConflict: "fact_id,user_id" })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async deleteReviewVote(reviewId: string) {
    const supabase = getClient();
    const { error } = await supabase.from("review_votes").delete().eq("review_id", reviewId);
    if (error) throw error;
  }

  static async deleteFactVote(factId: string) {
    const supabase = getClient();
    const { error } = await supabase.from("fact_votes").delete().eq("fact_id", factId);
    if (error) throw error;
  }

  // Community fact check (verify/dispute/needs_evidence) — matches mobile.
  // One vote per user per fact (upserts on fact_id,user_id). RLS sets the row owner.
  static async submitFactCheck(params: {
    factId: string;
    vote: "verify" | "dispute" | "needs_evidence";
    comment?: string;
    evidenceUrl?: string;
  }) {
    const supabase = getClient();
    const { data: { session } } = await supabase.auth.getSession();
    const payload: Record<string, unknown> = { fact_id: params.factId, vote: params.vote, user_id: session?.user?.id };
    if (params.comment !== undefined) payload.comment = params.comment;
    if (params.evidenceUrl !== undefined) payload.evidence_url = params.evidenceUrl;
    const { data, error } = await supabase.from("fact_checks")
      .upsert(payload, { onConflict: "fact_id,user_id" })
      .select().single();
    if (error) throw error;
    return data;
  }

  // === Homepage ===

  static async getTrendingListings(limit = 5): Promise<Listing[]> {
    // Served by the server-side route handler (was direct DynamoDB catalog).
    // The catalog has no review-count index, so "trending" is approximated by
    // the most recently added businesses.
    const res = await fetch(`/api/catalog/recent?type=business&limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  }

  static async getRecentlyAddedListings(limit = 5): Promise<Listing[]> {
    // Served by the server-side route handler (was direct DynamoDB catalog).
    const res = await fetch(`/api/catalog/recent?type=business&limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  }

  static async getRecentVerifiedFacts(limit = 5) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username, reputation_score, credibility_level), listing:listings!facts_listing_id_fkey(name, slug)")
      .eq("verification_status", "verified").eq("is_flagged", false)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async getDisputedFacts(limit = 5) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username, reputation_score, credibility_level), listing:listings!facts_listing_id_fkey(name, slug)")
      .eq("verification_status", "disputed").eq("is_flagged", false)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async getFactCheckTallies(factIds: string[]): Promise<Record<string, { verify: number; dispute: number }>> {
    if (factIds.length === 0) return {};
    const supabase = getClient();
    const { data, error } = await supabase.from("fact_checks")
      .select("fact_id, vote").in("fact_id", factIds);
    if (error) throw error;
    const out: Record<string, { verify: number; dispute: number }> = {};
    for (const row of (data || []) as Array<{ fact_id: string; vote: string }>) {
      const cur = out[row.fact_id] ?? { verify: 0, dispute: 0 };
      if (row.vote === "verify") cur.verify += 1;
      else if (row.vote === "dispute") cur.dispute += 1;
      out[row.fact_id] = cur;
    }
    return out;
  }

  static async getListingsFactCounts(listingIds: string[]) {
    if (listingIds.length === 0) return [];
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("listing_id, category, verification_status")
      .in("listing_id", listingIds).eq("is_flagged", false);
    if (error) throw error;
    return (data || []) as Array<{ listing_id: string; category: string; verification_status: string }>;
  }

  static async getTagsisFacts(limit = 10) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, listing:listings!facts_listing_id_fkey(name, slug)")
      .eq("category", "safety").eq("verification_status", "verified").eq("is_flagged", false)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  // === User Activity ===

  static async getUserReviews(userId: string, limit = 20) {
    const supabase = getClient();
    const { data, error } = await supabase.from("reviews")
      .select("*, listing:listings!reviews_listing_id_fkey(name, slug)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async getUserFacts(userId: string, limit = 20) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, listing:listings!facts_listing_id_fkey(name, slug)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  static async deleteReview(reviewId: string) {
    const supabase = getClient();
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (error) throw error;
  }

  static async deleteFact(factId: string) {
    const supabase = getClient();
    const { error } = await supabase.from("facts").delete().eq("id", factId);
    if (error) throw error;
  }

  // === Claim Submit Flow ===

  // File a pending ownership claim for the current user. Any authenticated user
  // may do this (they become a business_owner only when an admin verifies it).
  // Returns the new claim id so a document can be uploaded into its folder.
  static async createClaim(params: {
    listingId: string; userId: string; role: string; verificationMethod: string;
    taxNumber: string; consentAt: string;
    capturedLat?: number; capturedLng?: number; livenessNonce?: string;
  }) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_claims").insert({
      listing_id: params.listingId, user_id: params.userId, role: params.role, status: "pending",
      verification_method: params.verificationMethod, tax_number: params.taxNumber, consent_at: params.consentAt,
      captured_lat: params.capturedLat ?? null, captured_lng: params.capturedLng ?? null,
      liveness_nonce: params.livenessNonce ?? null,
    }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }

  // TEST/FIXTURE USE ONLY — live web claim flow is video-only (see MobileHandoff)
  // Upload a verification document into the PRIVATE bilinc-verification bucket,
  // folder convention <userId>/<claimId>/<file>, then store the path (NOT a
  // public URL) on the claim. The bucket has no public-read policy.
  static async uploadVerificationDoc(userId: string, claimId: string, file: File) {
    const supabase = getClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${userId}/${claimId}/belge.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("bilinc-verification")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { error } = await supabase.from("listing_claims")
      .update({ verification_document_url: path }).eq("id", claimId);
    if (error) throw error;
    return path;
  }

  // A user's own non-verified claims (pending/rejected/etc.) so they can see status.
  static async getMyClaims(userId: string) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_claims")
      .select("*, listing:listings!listing_claims_listing_id_fkey(id, name, slug)")
      .eq("user_id", userId).neq("status", "verified")
      .order("requested_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Short-TTL signed URL for an admin to view a private verification document.
  static async getSignedVerificationUrl(path: string) {
    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from("bilinc-verification").createSignedUrl(path, 60);
    if (error) throw error;
    return data.signedUrl;
  }

  // === Business Owner Methods ===

  static async getClaimedListings(userId: string) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_claims")
      .select("*, listing:listings!listing_claims_listing_id_fkey(id, name, slug, entity_type, average_rating, total_reviews, city_code, status)")
      .eq("user_id", userId).eq("status", "verified");
    if (error) throw error;
    return data || [];
  }

  static async getListingReviewsForOwner(listingId: string, limit = 20, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("reviews")
      .select("*, user:users!reviews_user_id_fkey(username, credibility_level), response:review_responses!review_responses_review_id_fkey(*)")
      .eq("listing_id", listingId).order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async getListingFactsForOwner(listingId: string, limit = 20, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username, credibility_level), response:fact_responses!fact_responses_fact_id_fkey(*)")
      .eq("listing_id", listingId).order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async respondToReview(params: { reviewId: string; listingId: string; content: string; userId: string }) {
    const supabase = getClient();
    const { data, error } = await supabase.from("review_responses")
      .insert({ review_id: params.reviewId, listing_id: params.listingId, content: params.content, user_id: params.userId })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async respondToFact(params: { factId: string; listingId: string; content: string; userId: string }) {
    const supabase = getClient();
    const { data, error } = await supabase.from("fact_responses")
      .insert({ fact_id: params.factId, listing_id: params.listingId, content: params.content, user_id: params.userId })
      .select().single();
    if (error) throw error;
    return data;
  }

  static async getSubscription(userId: string) {
    const supabase = getClient();
    const { data, error } = await supabase.from("subscriptions")
      .select("*").eq("user_id", userId).eq("status", "active").single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // === Admin Methods ===

  static async getAdminStats(): Promise<AdminStats | null> {
    const supabase = getClient();
    const { data, error } = await supabase.rpc("get_admin_stats");
    if (error) throw error;
    return data?.[0] || null;
  }

  static async getAllUsers(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("users")
      .select("*").order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async updateUserStatus(userId: string, isActive: boolean) {
    const supabase = getClient();
    const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId);
    if (error) throw error;
  }

  static async updateUserType(userId: string, userType: string) {
    const supabase = getClient();
    const { error } = await supabase.from("users").update({ user_type: userType }).eq("id", userId);
    if (error) throw error;
  }

  static async getFlaggedReviews(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("reviews")
      .select("*, user:users!reviews_user_id_fkey(username), listing:listings!reviews_listing_id_fkey(name)")
      .eq("is_flagged", true).order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async getFlaggedFacts(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username), listing:listings!facts_listing_id_fkey(name)")
      .eq("is_flagged", true).order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async updateReviewStatus(reviewId: string, status: string) {
    const supabase = getClient();
    const { error } = await supabase.from("reviews").update({ status, is_flagged: false }).eq("id", reviewId);
    if (error) throw error;
  }

  static async updateFactStatus(factId: string, verificationStatus: string) {
    const supabase = getClient();
    const { error } = await supabase.from("facts")
      .update({ verification_status: verificationStatus, is_flagged: false }).eq("id", factId);
    if (error) throw error;
  }

  static async getPendingClaims(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_claims")
      .select("*, user:users!listing_claims_user_id_fkey(username, user_type), listing:listings!listing_claims_listing_id_fkey(name, slug, address_line, city_code)")
      .eq("status", "pending").order("requested_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async getVerifiedClaims(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_claims")
      .select("*, user:users!listing_claims_user_id_fkey(username), listing:listings!listing_claims_listing_id_fkey(name, slug)")
      .eq("status", "verified").order("verified_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  // Approve/reject/revoke a claim. Delegates to the atomic SECURITY DEFINER RPC
  // private.decide_claim which runs fetch + audit insert + row update + storage delete
  // + user promotion in a single transaction, preventing partial-update races.
  static async updateClaimStatus(
    claimId: string,
    status: string,
    adminId: string,
    rejectionReason?: string,
  ) {
    const supabase = getClient();
    const { error } = await supabase.rpc("decide_claim",
      { p_claim: claimId, p_status: status, p_admin: adminId, p_reason: rejectionReason ?? null });
    if (error) throw error;
  }

  static async revokeClaim(claimId: string, adminId: string, reason?: string) {
    return DatabaseService.updateClaimStatus(claimId, "revoked", adminId, reason);
  }

  static async getPendingEdits(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("listing_edits")
      .select("*, user:users!listing_edits_user_id_fkey(username), listing:listings!listing_edits_listing_id_fkey(name)")
      .eq("status", "pending").order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async updateEditStatus(editId: string, status: string, rejectionReason?: string) {
    const supabase = getClient();
    const updates: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
    if (rejectionReason) updates.rejection_reason = rejectionReason;
    const { error } = await supabase.from("listing_edits").update(updates).eq("id", editId);
    if (error) throw error;
  }

  static async getAllListingsAdmin(limit = 50, offset = 0, status?: string) {
    const supabase = getClient();
    let query = supabase.from("listings")
      .select("*, created_by_user:users!listings_created_by_fkey(username)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async updateListingStatus(listingId: string, status: string) {
    const supabase = getClient();
    const { error } = await supabase.from("listings").update({ status }).eq("id", listingId);
    if (error) throw error;
  }

  static async getAllReviewsAdmin(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("reviews")
      .select("*, user:users!reviews_user_id_fkey(username), listing:listings!reviews_listing_id_fkey(name)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static async getAllFactsAdmin(limit = 50, offset = 0) {
    const supabase = getClient();
    const { data, error } = await supabase.from("facts")
      .select("*, user:users!facts_user_id_fkey(username), listing:listings!facts_listing_id_fkey(name)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  static generateSlug(text: string): string {
    return text.toLowerCase().trim()
      .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ğ/g, "g").replace(/Ğ/g, "g")
      .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ş/g, "s").replace(/Ş/g, "s")
      .replace(/ö/g, "o").replace(/Ö/g, "o").replace(/ç/g, "c").replace(/Ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  }
}
