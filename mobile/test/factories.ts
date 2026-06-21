/**
 * Test data factories.
 * Each builder returns a valid typed object with sensible defaults,
 * accepting partial overrides so tests only declare what they care about.
 */
import type {
  User,
  Listing,
  Review,
  Fact,
  ListingClaim,
  ReviewResponse,
  FactResponse,
  FactCheck,
} from '../src/types';

let _seq = 1;
const seq = () => String(_seq++);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const aUser = (o: Partial<User> = {}): User => ({
  id: `u${seq()}`,
  username: 'tester',
  user_type: 'consumer',
  reputation_score: 0,
  credibility_level: 'novice',
  created_at: '2026-01-01T00:00:00Z',
  last_active: '2026-01-01T00:00:00Z',
  is_active: true,
  ...o,
});

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
export const aListing = (o: Partial<Listing> = {}): Listing => ({
  id: `l${seq()}`,
  slug: 'test-listing',
  name: 'Test Listing',
  entity_type: 'business',
  status: 'active',
  average_rating: 0,
  total_reviews: 0,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export const aReview = (o: Partial<Review> = {}): Review => ({
  id: `r${seq()}`,
  listing_id: 'l1',
  user_id: 'u1',
  rating: 3,
  content: 'Test review content',
  helpful_count: 0,
  status: 'active',
  is_flagged: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------
export const aFact = (o: Partial<Fact> = {}): Fact => ({
  id: `f${seq()}`,
  listing_id: 'l1',
  user_id: 'u1',
  statement: 'Test fact statement',
  category: 'safety',
  verification_status: 'pending',
  truth_guarantee: true,
  helpful_count: 0,
  is_flagged: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// ListingClaims
// ---------------------------------------------------------------------------
export const aListingClaim = (o: Partial<ListingClaim> = {}): ListingClaim => ({
  id: `c${seq()}`,
  listing_id: 'l1',
  user_id: 'u1',
  role: 'owner',
  status: 'pending',
  requested_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// ReviewResponse (business owner reply to a review)
// ---------------------------------------------------------------------------
export const aReviewResponse = (o: Partial<ReviewResponse> = {}): ReviewResponse => ({
  id: `rr${seq()}`,
  review_id: 'r1',
  listing_id: 'l1',
  user_id: 'u1',
  content: 'Thank you for your feedback.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// FactResponse (business owner reply to a fact)
// ---------------------------------------------------------------------------
export const aFactResponse = (o: Partial<FactResponse> = {}): FactResponse => ({
  id: `fr${seq()}`,
  fact_id: 'f1',
  listing_id: 'l1',
  user_id: 'u1',
  content: 'We dispute this claim.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...o,
});

// ---------------------------------------------------------------------------
// FactCheck (community verification vote on a fact)
// ---------------------------------------------------------------------------
export const aFactCheck = (o: Partial<FactCheck> = {}): FactCheck => ({
  id: `fc${seq()}`,
  fact_id: 'f1',
  user_id: 'u1',
  vote: 'verify',
  created_at: '2026-01-01T00:00:00Z',
  ...o,
});
