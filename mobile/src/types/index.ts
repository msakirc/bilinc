export type UserType = 'consumer' | 'business_owner' | 'admin';

export type CredibilityLevel = 'novice' | 'contributor' | 'trusted' | 'expert';

export type EntityType = 'business' | 'product' | 'brand';

export type ListingStatus = 'active' | 'pending' | 'merged' | 'removed' | 'duplicate';

export type FactCategory = 'safety' | 'ownership' | 'health' | 'quality' | 'legal' | 'environmental' | 'abuse' | 'labor' | 'other';

export type VerificationStatus = 'pending' | 'verified' | 'disputed' | 'needs_review' | 'retracted';

export type ClaimStatus = 'pending' | 'verified' | 'rejected' | 'revoked' | 'expired';

export type ClaimRole = 'owner' | 'manager' | 'employee';

export type PhotoStatus = 'active' | 'pending' | 'rejected';

export type VoteType = 'helpful' | 'not_helpful';

export type ReviewStatus = 'active' | 'hidden' | 'removed';

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
  listing_count?: number; // Added for category listings count
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
  // Additional fields from listing_full view
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

export interface ListingPhoto {
  id: string;
  listing_id: string;
  uploaded_by: string;
  url: string;
  caption?: string;
  is_primary: boolean;
  source: string;
  status: PhotoStatus;
  sort_order: number;
  created_at: string;
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
  verified_by?: string;
  verified_at?: string;
  requested_at: string;
  expires_at?: string;
  rejection_reason?: string;
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
}

export interface ReviewPhoto {
  id: string;
  review_id: string;
  url: string;
  caption?: string;
  sort_order: number;
  created_at: string;
}

export interface ReviewVote {
  review_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
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
}

export interface FactCheck {
  id: string;
  fact_id: string;
  user_id: string;
  vote: string;
  comment?: string;
  evidence_url?: string;
  created_at: string;
}

export interface FactVote {
  fact_id: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
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

// Search and explore types
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

export interface NearbyResult extends SearchResult {
  latitude: number;
  longitude: number;
  distance_km: number;
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

export interface ExploreSection {
  section: string;
  items: any[]; // JSONB data from database
}

export interface CategoryCount {
  classification: string;
  count: number;
}

export interface BreadcrumbItem {
  level: number;
  id: string;
  name: string;
  slug: string;
  entity_type: EntityType;
  classification?: string;
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

export interface AuthState {
  user: User | null;
  session: any;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}