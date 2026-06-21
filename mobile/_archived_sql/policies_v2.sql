-- =====================================================
-- BİLİNÇ PRODUCTION DATABASE SECURITY SCRIPT
-- Version: 1.0.0
-- Run this script ONCE on a fresh database or after
-- backing up existing data
-- =====================================================

-- =====================================================
-- STEP 1: ENABLE REQUIRED EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 2: DROP ALL EXISTING POLICIES (Clean Slate)
-- =====================================================

-- Users policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Public can view user profiles" ON users;

-- Listings policies
DROP POLICY IF EXISTS "Public can view listings" ON listings;
DROP POLICY IF EXISTS "Authenticated users can create listings" ON listings;
DROP POLICY IF EXISTS "Creators can update own listings" ON listings;
DROP POLICY IF EXISTS "Owners can update claimed listings" ON listings;

-- Reviews policies
DROP POLICY IF EXISTS "Public can view reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

-- Facts policies
DROP POLICY IF EXISTS "Public can view facts" ON facts;
DROP POLICY IF EXISTS "Qualified users can create facts" ON facts;
DROP POLICY IF EXISTS "Users can update own facts" ON facts;
DROP POLICY IF EXISTS "Users can delete own facts" ON facts;

-- Fact checks policies
DROP POLICY IF EXISTS "Public can view fact checks" ON fact_checks;
DROP POLICY IF EXISTS "Authenticated users can create fact checks" ON fact_checks;
DROP POLICY IF EXISTS "Users can update own fact checks" ON fact_checks;
DROP POLICY IF EXISTS "Users can delete own fact checks" ON fact_checks;

-- Listing claims policies
DROP POLICY IF EXISTS "Users can view own claims" ON listing_claims;
DROP POLICY IF EXISTS "Business owners can create claims" ON listing_claims;
DROP POLICY IF EXISTS "Owners can update own claims" ON listing_claims;

-- Responses policies
DROP POLICY IF EXISTS "Public can view responses" ON responses;
DROP POLICY IF EXISTS "Owners can create responses" ON responses;
DROP POLICY IF EXISTS "Owners can update own responses" ON responses;
DROP POLICY IF EXISTS "Owners can delete own responses" ON responses;

-- Media uploads policies
DROP POLICY IF EXISTS "Public can view media" ON media_uploads;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON media_uploads;
DROP POLICY IF EXISTS "Users can update own media" ON media_uploads;
DROP POLICY IF EXISTS "Users can delete own media" ON media_uploads;

-- Votes policies
DROP POLICY IF EXISTS "Public can view votes" ON votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON votes;
DROP POLICY IF EXISTS "Users can update own votes" ON votes;
DROP POLICY IF EXISTS "Users can delete own votes" ON votes;

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;

-- =====================================================
-- STEP 3: DROP EXISTING TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_reputation_on_review_change ON reviews;
DROP TRIGGER IF EXISTS update_reputation_on_fact_change ON facts;
DROP TRIGGER IF EXISTS update_reputation_on_vote_change ON votes;
DROP TRIGGER IF EXISTS update_listing_stats_on_review_change ON reviews;

-- =====================================================
-- STEP 4: DROP EXISTING FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS update_user_reputation() CASCADE;
DROP FUNCTION IF EXISTS update_listing_stats() CASCADE;
DROP FUNCTION IF EXISTS get_user_reputation(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_type(UUID) CASCADE;
DROP FUNCTION IF EXISTS verify_security_answer(UUID, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_security_questions(UUID, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- =====================================================
-- STEP 5: MODIFY USERS TABLE
-- =====================================================

-- Remove auto-generated UUID - ID must come from Supabase Auth (auth.uid())
-- This ensures users.id always matches auth.users.id
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Add index for performance on commonly queried columns
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_reputation_score ON users(reputation_score);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- =====================================================
-- STEP 6: CREATE USER_SECURITY TABLE (Sensitive Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_security (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  security_question_1 TEXT NOT NULL,
  security_answer_1_hash TEXT NOT NULL,
  security_question_2 TEXT NOT NULL,
  security_answer_2_hash TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON user_security(user_id);

-- Enable RLS
ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: CREATE SECURITY DEFINER HELPER FUNCTIONS
-- =====================================================

-- Function to safely get user reputation (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(reputation_score, 0)
  FROM users
  WHERE id = p_user_id;
$$;

-- Function to safely get user type (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT user_type
  FROM users
  WHERE id = p_user_id;
$$;

-- Function to check if user owns a listing claim
CREATE OR REPLACE FUNCTION user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM listing_claims
    WHERE listing_id = p_listing_id
    AND owner_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- =====================================================
-- STEP 8: CREATE SECURITY QUESTIONS FUNCTIONS
-- =====================================================

-- Function to hash security answers (internal use)
CREATE OR REPLACE FUNCTION hash_security_answer(p_answer TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalize: lowercase, trim whitespace
  -- Using bcrypt via pgcrypto (bf = blowfish)
  RETURN crypt(lower(trim(p_answer)), gen_salt('bf', 10));
END;
$$;

-- Function to set security questions (called during setup)
CREATE OR REPLACE FUNCTION set_security_questions(
  p_question_1 TEXT,
  p_answer_1 TEXT,
  p_question_2 TEXT,
  p_answer_2 TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate inputs
  IF length(trim(p_answer_1)) < 3 OR length(trim(p_answer_2)) < 3 THEN
    RAISE EXCEPTION 'Security answers must be at least 3 characters';
  END IF;

  -- Insert or update security questions
  INSERT INTO user_security (
    user_id,
    security_question_1,
    security_answer_1_hash,
    security_question_2,
    security_answer_2_hash,
    updated_at
  ) VALUES (
    v_user_id,
    trim(p_question_1),
    hash_security_answer(p_answer_1),
    trim(p_question_2),
    hash_security_answer(p_answer_2),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    security_question_1 = EXCLUDED.security_question_1,
    security_answer_1_hash = EXCLUDED.security_answer_1_hash,
    security_question_2 = EXCLUDED.security_question_2,
    security_answer_2_hash = EXCLUDED.security_answer_2_hash,
    updated_at = NOW(),
    failed_attempts = 0,
    locked_until = NULL;

  RETURN TRUE;
END;
$$;

-- Function to get security questions (for password reset flow)
CREATE OR REPLACE FUNCTION get_security_questions(p_username TEXT)
RETURNS TABLE(question_1 TEXT, question_2 TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from username
  SELECT id INTO v_user_id
  FROM users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    -- Return empty to not reveal if user exists
    RETURN;
  END IF;

  -- Return questions (never return answers!)
  RETURN QUERY
  SELECT
    us.security_question_1,
    us.security_question_2
  FROM user_security us
  WHERE us.user_id = v_user_id;
END;
$$;

-- Function to verify security answers (for password reset)
CREATE OR REPLACE FUNCTION verify_security_answers(
  p_username TEXT,
  p_answer_1 TEXT,
  p_answer_2 TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, reset_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_stored_hash_1 TEXT;
  v_stored_hash_2 TEXT;
  v_failed_attempts INTEGER;
  v_locked_until TIMESTAMP WITH TIME ZONE;
  v_reset_token UUID;
BEGIN
  -- Get user ID from username
  SELECT id INTO v_user_id
  FROM users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    -- Generic error to prevent user enumeration
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Get security data
  SELECT
    security_answer_1_hash,
    security_answer_2_hash,
    failed_attempts,
    locked_until
  INTO v_stored_hash_1, v_stored_hash_2, v_failed_attempts, v_locked_until
  FROM user_security
  WHERE user_id = v_user_id;

  IF v_stored_hash_1 IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Security questions not set'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if account is locked
  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN QUERY SELECT FALSE,
      format('Account locked. Try again after %s', v_locked_until)::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  -- Verify both answers
  IF crypt(lower(trim(p_answer_1)), v_stored_hash_1) = v_stored_hash_1
     AND crypt(lower(trim(p_answer_2)), v_stored_hash_2) = v_stored_hash_2 THEN

    -- Success - reset failed attempts and generate token
    UPDATE user_security
    SET failed_attempts = 0, locked_until = NULL
    WHERE user_id = v_user_id;

    -- Generate a reset token (you'd store this and use it in your reset flow)
    v_reset_token := uuid_generate_v4();

    RETURN QUERY SELECT TRUE, 'Verification successful'::TEXT, v_reset_token;
  ELSE
    -- Failed - increment attempts
    v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

    UPDATE user_security
    SET
      failed_attempts = v_failed_attempts,
      locked_until = CASE
        WHEN v_failed_attempts >= 5 THEN NOW() + INTERVAL '30 minutes'
        WHEN v_failed_attempts >= 3 THEN NOW() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE user_id = v_user_id;

    IF v_failed_attempts >= 5 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 30 minutes'::TEXT, NULL::UUID;
    ELSIF v_failed_attempts >= 3 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 5 minutes'::TEXT, NULL::UUID;
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- STEP 9: CREATE REPUTATION UPDATE FUNCTION & TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_user_id UUID;
  v_new_score INTEGER;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate new reputation score
  SELECT INTO v_new_score (
    -- Points from helpful votes on reviews (2 points each)
    COALESCE((
      SELECT SUM(helpful_votes) * 2
      FROM reviews
      WHERE user_id = v_target_user_id
    ), 0) +
    -- Points for verified facts (5 points each)
    COALESCE((
      SELECT COUNT(*) * 5
      FROM facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'verified'
    ), 0) +
    -- Activity bonus (1 point per contribution, max 50)
    LEAST(
      COALESCE((SELECT COUNT(*) FROM reviews WHERE user_id = v_target_user_id), 0) +
      COALESCE((SELECT COUNT(*) FROM facts WHERE user_id = v_target_user_id), 0),
      50
    ) -
    -- Penalty for disputed facts (-3 points each)
    COALESCE((
      SELECT COUNT(*) * 3
      FROM facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'disputed'
    ), 0)
  );

  -- Ensure score doesn't go negative
  v_new_score := GREATEST(v_new_score, 0);

  -- Update user record
  UPDATE users
  SET
    reputation_score = v_new_score,
    credibility_level = CASE
      WHEN v_new_score >= 500 THEN 'expert'
      WHEN v_new_score >= 200 THEN 'trusted'
      WHEN v_new_score >= 50 THEN 'contributor'
      ELSE 'novice'
    END,
    last_active = NOW()
  WHERE id = v_target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER update_reputation_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

CREATE TRIGGER update_reputation_on_fact_change
AFTER INSERT OR UPDATE OR DELETE ON facts
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

CREATE TRIGGER update_reputation_on_vote_change
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION update_user_reputation();

-- =====================================================
-- STEP 10: CREATE LISTING STATS FUNCTION & TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_listing_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_listing_id UUID;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE listings
  SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE listing_id = v_listing_id
      AND is_flagged = FALSE
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE listing_id = v_listing_id
      AND is_flagged = FALSE
    )
  WHERE id = v_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_listing_stats_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_listing_stats();

-- =====================================================
-- STEP 11: CREATE ROW LEVEL SECURITY POLICIES
-- =====================================================

-- ---------------------
-- USERS TABLE POLICIES
-- ---------------------
CREATE POLICY "users_select_public" ON users
FOR SELECT USING (true);

CREATE POLICY "users_insert_own" ON users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- No delete policy - users should be deactivated, not deleted

-- ---------------------
-- USER_SECURITY TABLE POLICIES (Strict - Owner Only)
-- ---------------------
CREATE POLICY "user_security_select_own" ON user_security
FOR SELECT USING (auth.uid() = user_id);

-- Insert/Update handled via security definer functions only
-- No direct INSERT/UPDATE policies for extra security

-- ---------------------
-- LISTINGS TABLE POLICIES
-- ---------------------
CREATE POLICY "listings_select_public" ON listings
FOR SELECT USING (true);

CREATE POLICY "listings_insert_authenticated" ON listings
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
);

CREATE POLICY "listings_update_creator" ON listings
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "listings_update_owner" ON listings
FOR UPDATE
USING (user_owns_listing(auth.uid(), id))
WITH CHECK (user_owns_listing(auth.uid(), id));

-- ---------------------
-- REVIEWS TABLE POLICIES
-- ---------------------
CREATE POLICY "reviews_select_public" ON reviews
FOR SELECT USING (true);

CREATE POLICY "reviews_insert_authenticated" ON reviews
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  -- Prevent reviewing own listings
  AND NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = listing_id
    AND created_by = auth.uid()
  )
  AND NOT user_owns_listing(auth.uid(), listing_id)
);

CREATE POLICY "reviews_update_own" ON reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON reviews
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- FACTS TABLE POLICIES
-- ---------------------
CREATE POLICY "facts_select_public" ON facts
FOR SELECT USING (true);

CREATE POLICY "facts_insert_qualified" ON facts
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND get_user_reputation(auth.uid()) >= 100
);

CREATE POLICY "facts_update_own" ON facts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "facts_delete_own" ON facts
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- FACT_CHECKS TABLE POLICIES
-- ---------------------
CREATE POLICY "fact_checks_select_public" ON fact_checks
FOR SELECT USING (true);

CREATE POLICY "fact_checks_insert_authenticated" ON fact_checks
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  -- Can't fact-check your own facts
  AND NOT EXISTS (
    SELECT 1 FROM facts
    WHERE id = fact_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "fact_checks_update_own" ON fact_checks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fact_checks_delete_own" ON fact_checks
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- LISTING_CLAIMS TABLE POLICIES
-- ---------------------
CREATE POLICY "listing_claims_select_own" ON listing_claims
FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "listing_claims_insert_business_owner" ON listing_claims
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = owner_id
  AND get_user_type(auth.uid()) = 'business_owner'
  -- Prevent duplicate active claims
  AND NOT EXISTS (
    SELECT 1 FROM listing_claims
    WHERE listing_id = listing_claims.listing_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  )
);

CREATE POLICY "listing_claims_update_own" ON listing_claims
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- ---------------------
-- RESPONSES TABLE POLICIES
-- ---------------------
CREATE POLICY "responses_select_public" ON responses
FOR SELECT USING (true);

CREATE POLICY "responses_insert_owner" ON responses
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = owner_id
  AND user_owns_listing(auth.uid(), listing_id)
);

CREATE POLICY "responses_update_own" ON responses
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "responses_delete_own" ON responses
FOR DELETE USING (auth.uid() = owner_id);

-- ---------------------
-- MEDIA_UPLOADS TABLE POLICIES
-- ---------------------
CREATE POLICY "media_uploads_select_public" ON media_uploads
FOR SELECT USING (true);

CREATE POLICY "media_uploads_insert_authenticated" ON media_uploads
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

CREATE POLICY "media_uploads_update_own" ON media_uploads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_uploads_delete_own" ON media_uploads
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- VOTES TABLE POLICIES
-- ---------------------
CREATE POLICY "votes_select_public" ON votes
FOR SELECT USING (true);

CREATE POLICY "votes_insert_authenticated" ON votes
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  -- Prevent duplicate votes (one vote per user per target)
  AND NOT EXISTS (
    SELECT 1 FROM votes v
    WHERE v.user_id = auth.uid()
    AND v.target_type = votes.target_type
    AND v.target_id = votes.target_id
  )
);

CREATE POLICY "votes_update_own" ON votes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "votes_delete_own" ON votes
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- SUBSCRIPTIONS TABLE POLICIES
-- ---------------------
CREATE POLICY "subscriptions_select_own" ON subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert_own" ON subscriptions
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

CREATE POLICY "subscriptions_update_own" ON subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- STEP 12: ADD PERFORMANCE INDEXES
-- =====================================================

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_entity_type ON listings(entity_type);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_created_by ON listings(created_by);
CREATE INDEX IF NOT EXISTS idx_listings_is_claimed ON listings(is_claimed);
CREATE INDEX IF NOT EXISTS idx_listings_average_rating ON listings(average_rating DESC);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Facts indexes
CREATE INDEX IF NOT EXISTS idx_facts_listing_id ON facts(listing_id);
CREATE INDEX IF NOT EXISTS idx_facts_user_id ON facts(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_verification_status ON facts(verification_status);
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);

-- Fact checks indexes
CREATE INDEX IF NOT EXISTS idx_fact_checks_fact_id ON fact_checks(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_checks_user_id ON fact_checks(user_id);

-- Listing claims indexes
CREATE INDEX IF NOT EXISTS idx_listing_claims_listing_id ON listing_claims(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_claims_owner_id ON listing_claims(owner_id);
CREATE INDEX IF NOT EXISTS idx_listing_claims_active ON listing_claims(is_active) WHERE is_active = true;

-- Responses indexes
CREATE INDEX IF NOT EXISTS idx_responses_listing_id ON responses(listing_id);
CREATE INDEX IF NOT EXISTS idx_responses_target ON responses(target_type, target_id);

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- STEP 13: ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Prevent duplicate votes
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique
ON votes(user_id, target_type, target_id);

-- Prevent duplicate fact checks by same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_checks_unique
ON fact_checks(user_id, fact_id);

-- Prevent duplicate reviews by same user on same listing
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique
ON reviews(user_id, listing_id);

-- =====================================================
-- STEP 14: GRANT PERMISSIONS
-- =====================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_reputation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_type(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_owns_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_security_questions(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_security_questions(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_securituyyy_answers(TEXT, TEXT, TEXT) TO anon, authenticated;

-- =====================================================
-- STEP 15: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE user_security IS 'Stores hashed security questions/answers for password recovery. Never expose answer hashes.';
COMMENT ON FUNCTION set_security_questions IS 'Securely sets security questions. Answers are bcrypt hashed.';
COMMENT ON FUNCTION verify_security_answers IS 'Verifies security answers with rate limiting and account lockout.';
COMMENT ON FUNCTION get_user_reputation IS 'SECURITY DEFINER function to get user reputation without RLS recursion.';
COMMENT ON FUNCTION get_user_type IS 'SECURITY DEFINER function to get user type without RLS recursion.';


SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users';

SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%users%' OR with_check ILIKE '%users%')
  AND tablename <> 'users';
