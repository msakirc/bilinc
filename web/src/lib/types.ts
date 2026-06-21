export type UserType = "consumer" | "business_owner" | "admin";
export type CredibilityLevel = "novice" | "contributor" | "trusted" | "expert";
export type EntityType = "business" | "product" | "brand";
export type ListingStatus = "active" | "pending" | "merged" | "removed" | "duplicate";
export type FactCategory = "safety" | "ownership" | "health" | "quality" | "legal" | "environmental" | "abuse" | "labor" | "other";
export type VerificationStatus = "pending" | "verified" | "disputed" | "needs_review" | "retracted";
export type ClaimStatus = "pending" | "verified" | "rejected" | "revoked" | "expired";
export type ClaimRole = "owner" | "manager" | "employee";
export type PhotoStatus = "active" | "pending" | "rejected";
export type VoteType = "helpful" | "not_helpful";
export type ReviewStatus = "active" | "hidden" | "removed";

export interface User {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  user_type: UserType;
  reputation_score: number;
  credibility_level: CredibilityLevel;
  created_at: string;
  last_active: string;
  is_active: boolean;
}

export interface City {
  code: string;
  name: string;
  slug: string;
  region: string;
}

export interface District {
  id: number;
  city_code: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  name_en?: string;
  icon?: string;
  parent_id?: string;
  sort_order: number;
  allowed_types: string[];
  created_at: string;
  listing_count?: number;
}

export interface Listing {
  id: string;
  slug: string;
  name: string;
  description?: string;
  entity_type: EntityType;
  status: ListingStatus;
  parent_id?: string;
  city_code?: string;
  district_id?: number;
  address_line?: string;
  latitude?: number;
  longitude?: number;
  merged_into_id?: string;
  average_rating: number;
  total_reviews: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  classification?: string;
  city_name?: string;
  city_slug?: string;
  district_name?: string;
  district_slug?: string;
  region?: string;
  category_id?: string;
  category_slug?: string;
  category_name?: string;
  category_icon?: string;
  parent_name?: string;
  parent_slug?: string;
  parent_type?: string;
  is_claimed?: boolean;
  claimed_by?: string;
  primary_photo_url?: string;
}

export interface Review {
  id: string;
  listing_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content: string;
  helpful_count: number;
  status: ReviewStatus;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  user?: { username: string; reputation_score: number; credibility_level: string };
  listing?: { name: string; slug: string };
}

export interface Fact {
  id: string;
  listing_id: string;
  user_id: string;
  statement: string;
  category: FactCategory;
  verification_status: VerificationStatus;
  truth_guarantee: boolean;
  helpful_count: number;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  user?: { username: string; reputation_score: number; credibility_level: string };
  listing?: { name: string; slug: string };
}

export interface ListingClaim {
  id: string;
  listing_id: string;
  user_id: string;
  role: ClaimRole;
  status: ClaimStatus;
  verification_method?: string;
  verification_document_url?: string;
  verification_notes?: string;
  tax_number?: string;
  consent_at?: string;
  verified_by?: string;
  verified_at?: string;
  requested_at: string;
  expires_at?: string;
  rejection_reason?: string;
  user?: { username: string; user_type: string };
  listing?: { id: string; name: string; slug: string; entity_type: string; average_rating: number; total_reviews: number; city_code: string; status: string };
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  payment_provider?: string;
  payment_id?: string;
  started_at: string;
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string;
}

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  description?: string;
  entity_type: EntityType;
  classification?: string;
  parent_id?: string;
  parent_name?: string;
  parent_slug?: string;
  city_code?: string;
  city_name?: string;
  district_name?: string;
  category_slug?: string;
  category_name?: string;
  average_rating?: number;
  total_reviews?: number;
  primary_photo_url?: string;
  rank?: number;
}

export interface SearchSuggestion {
  id: string;
  name: string;
  slug: string;
  entity_type: EntityType;
  classification?: string;
  parent_name?: string;
  category_name?: string;
  city_name?: string;
  match_type: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  reputation_score: number;
  credibility_level: string;
  member_since: string;
  total_reviews: number;
  total_facts: number;
  verified_facts: number;
  helpful_votes_received: number;
}

export interface ListingStats {
  total_reviews: number;
  average_rating: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
  total_facts: number;
  verified_facts: number;
  disputed_facts: number;
  total_photos: number;
}

export interface ListingEdit {
  id: string;
  listing_id: string;
  user_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  user?: { username: string };
  listing?: { name: string };
}

export interface ReviewResponse {
  id: string;
  review_id: string;
  listing_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FactResponse {
  id: string;
  fact_id: string;
  listing_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users_30d: number;
  total_listings: number;
  pending_listings: number;
  total_reviews: number;
  reviews_today: number;
  total_facts: number;
  pending_claims: number;
  pending_edits: number;
}
