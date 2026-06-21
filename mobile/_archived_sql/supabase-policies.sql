-- Bilinç Supabase Row Level Security Policies
-- Execute this after creating the tables in the database

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (auth.uid() = id);

-- Allow registration (users can insert their own record during signup)
CREATE POLICY "Users can insert own profile" ON users
FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin policies temporarily disabled for MVP
-- Will be re-enabled with proper role management

-- =====================================================
-- LISTINGS TABLE POLICIES
-- =====================================================

-- Enable RLS on listings table
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Everyone can read all listings (public access)
CREATE POLICY "Public can view listings" ON listings
FOR SELECT USING (true);

-- Authenticated users can create listings
CREATE POLICY "Authenticated users can create listings" ON listings
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Listing creators can update their own listings
CREATE POLICY "Creators can update own listings" ON listings
FOR UPDATE USING (auth.uid() = created_by);

-- Listing owners (via claims) can update their claimed listings
CREATE POLICY "Owners can update claimed listings" ON listings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM listing_claims lc
    WHERE lc.listing_id = listings.id
    AND lc.owner_id = auth.uid()
    AND lc.is_active = true
  )
);

-- Admin listing management disabled for MVP

-- =====================================================
-- REVIEWS TABLE POLICIES
-- =====================================================

-- Enable RLS on reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can read reviews
CREATE POLICY "Public can view reviews" ON reviews
FOR SELECT USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews" ON reviews
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON reviews
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON reviews
FOR DELETE USING (auth.uid() = user_id);

-- Admin review moderation disabled for MVP

-- =====================================================
-- FACTS TABLE POLICIES
-- =====================================================

-- Enable RLS on facts table
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;

-- Everyone can read facts
CREATE POLICY "Public can view facts" ON facts
FOR SELECT USING (true);

-- Users with reputation >= 100 can create facts
CREATE POLICY "Qualified users can create facts" ON facts
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND reputation_score >= 100
  )
);

-- Users can update their own facts
CREATE POLICY "Users can update own facts" ON facts
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own facts
CREATE POLICY "Users can delete own facts" ON facts
FOR DELETE USING (auth.uid() = user_id);

-- Admin fact moderation disabled for MVP

-- =====================================================
-- FACT_CHECKS TABLE POLICIES
-- =====================================================

-- Enable RLS on fact_checks table
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;

-- Everyone can read fact checks
CREATE POLICY "Public can view fact checks" ON fact_checks
FOR SELECT USING (true);

-- Authenticated users can create fact checks
CREATE POLICY "Authenticated users can create fact checks" ON fact_checks
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own fact checks
CREATE POLICY "Users can update own fact checks" ON fact_checks
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own fact checks
CREATE POLICY "Users can delete own fact checks" ON fact_checks
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- LISTING_CLAIMS TABLE POLICIES
-- =====================================================

-- Enable RLS on listing_claims table
ALTER TABLE listing_claims ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own claims
CREATE POLICY "Users can view own claims" ON listing_claims
FOR SELECT USING (auth.uid() = owner_id);

-- Business owners can create claims
CREATE POLICY "Business owners can create claims" ON listing_claims
FOR INSERT WITH CHECK (
  auth.uid() = owner_id AND
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND user_type = 'business_owner'
  )
);

-- Claim owners can update their claims
CREATE POLICY "Owners can update own claims" ON listing_claims
FOR UPDATE USING (auth.uid() = owner_id);

-- Admin claim management disabled for MVP

-- =====================================================
-- RESPONSES TABLE POLICIES
-- =====================================================

-- Enable RLS on responses table
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Everyone can read responses
CREATE POLICY "Public can view responses" ON responses
FOR SELECT USING (true);

-- Listing owners can create responses for their claimed listings
CREATE POLICY "Owners can create responses" ON responses
FOR INSERT WITH CHECK (
  auth.uid() = owner_id AND
  EXISTS (
    SELECT 1 FROM listing_claims lc
    WHERE lc.listing_id = responses.listing_id
    AND lc.owner_id = auth.uid()
    AND lc.is_active = true
  )
);

-- Response owners can update their responses
CREATE POLICY "Owners can update own responses" ON responses
FOR UPDATE USING (auth.uid() = owner_id);

-- Response owners can delete their responses
CREATE POLICY "Owners can delete own responses" ON responses
FOR DELETE USING (auth.uid() = owner_id);

-- Admin response moderation disabled for MVP

-- =====================================================
-- MEDIA_UPLOADS TABLE POLICIES
-- =====================================================

-- Enable RLS on media_uploads table
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

-- Everyone can read media uploads (for public content)
CREATE POLICY "Public can view media" ON media_uploads
FOR SELECT USING (true);

-- Authenticated users can upload media
CREATE POLICY "Authenticated users can upload media" ON media_uploads
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own media
CREATE POLICY "Users can update own media" ON media_uploads
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own media
CREATE POLICY "Users can delete own media" ON media_uploads
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- VOTES TABLE POLICIES
-- =====================================================

-- Enable RLS on votes table
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read votes (for vote counts)
CREATE POLICY "Public can view votes" ON votes
FOR SELECT USING (true);

-- Authenticated users can create votes
CREATE POLICY "Authenticated users can vote" ON votes
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update own votes" ON votes
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes" ON votes
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- SUBSCRIPTIONS TABLE POLICIES
-- =====================================================

-- Enable RLS on subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
FOR SELECT USING (auth.uid() = user_id);

-- Users can create subscriptions for themselves
CREATE POLICY "Users can create own subscriptions" ON subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions" ON subscriptions
FOR UPDATE USING (auth.uid() = user_id);

-- Admin subscription management disabled for MVP

-- =====================================================
-- SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Admin functionality will be implemented later
-- For now, only basic user policies are active

-- owns_listing function removed to avoid recursion issues
-- Will be re-implemented later with proper role management

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update user reputation score
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  -- Calculate reputation based on contributions and community feedback
  UPDATE users
  SET reputation_score = (
    -- Base score from reviews (helpful votes)
    COALESCE((SELECT SUM(helpful_votes) FROM reviews WHERE user_id = users.id), 0) * 2 +
    -- Bonus for facts (verification score)
    COALESCE((
      SELECT COUNT(*) * 5
      FROM facts
      WHERE user_id = users.id
      AND verification_status = 'verified'
    ), 0) +
    -- Activity bonus
    LEAST(COALESCE((SELECT COUNT(*) FROM reviews WHERE user_id = users.id), 0) +
          COALESCE((SELECT COUNT(*) FROM facts WHERE user_id = users.id), 0), 50)
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  -- Update credibility level based on score
  UPDATE users
  SET credibility_level = CASE
    WHEN reputation_score >= 500 THEN 'expert'
    WHEN reputation_score >= 200 THEN 'trusted'
    WHEN reputation_score >= 50 THEN 'contributor'
    ELSE 'novice'
  END
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update reputation when reviews, facts, or votes change
CREATE TRIGGER update_reputation_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

CREATE TRIGGER update_reputation_on_fact_change
AFTER INSERT OR UPDATE OR DELETE ON facts
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

CREATE TRIGGER update_reputation_on_vote_change
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

-- Function to update listing stats
CREATE OR REPLACE FUNCTION update_listing_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE listings
  SET
    average_rating = (
      SELECT AVG(rating)::decimal(3,2)
      FROM reviews
      WHERE listing_id = listings.id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE listing_id = listings.id
    )
  WHERE id = NEW.listing_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update listing stats when reviews change
CREATE TRIGGER update_listing_stats_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_listing_stats();