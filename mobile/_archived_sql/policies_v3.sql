-- =====================================================
-- BİLİNÇ - FIXED INFINITE RECURSION SCRIPT
-- Run this on a fresh database or after dropping all policies
-- =====================================================

-- =====================================================
-- STEP 1: ENABLE EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 2: CLEAN UP - DROP ALL EXISTING POLICIES
-- =====================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: DROP EXISTING TRIGGERS AND FUNCTIONS
-- =====================================================

DROP TRIGGER IF EXISTS update_reputation_on_review_change ON reviews;
DROP TRIGGER IF EXISTS update_reputation_on_fact_change ON facts;
DROP TRIGGER IF EXISTS update_reputation_on_vote_change ON votes;
DROP TRIGGER IF EXISTS update_listing_stats_on_review_change ON reviews;

DROP FUNCTION IF EXISTS update_user_reputation() CASCADE;
DROP FUNCTION IF EXISTS update_listing_stats() CASCADE;
DROP FUNCTION IF EXISTS get_user_reputation(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_type(UUID) CASCADE;
DROP FUNCTION IF EXISTS user_owns_listing(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS hash_security_answer(TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_security_questions(TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_security_questions(TEXT) CASCADE;
DROP FUNCTION IF EXISTS verify_security_answers(TEXT, TEXT, TEXT) CASCADE;

-- =====================================================
-- STEP 4: MODIFY USERS TABLE
-- =====================================================

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- =====================================================
-- STEP 5: CREATE USER_SECURITY TABLE
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

CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON user_security(user_id);

-- =====================================================
-- STEP 6: CREATE PRIVATE SCHEMA FOR BYPASS FUNCTIONS
-- This schema will contain functions that bypass RLS
-- =====================================================

CREATE SCHEMA IF NOT EXISTS private;

-- =====================================================
-- STEP 7: CREATE BYPASS FUNCTIONS IN PRIVATE SCHEMA
-- These functions bypass RLS by querying directly
-- =====================================================

-- Get user reputation (bypasses RLS)
CREATE OR REPLACE FUNCTION private.get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(reputation_score, 0)
  FROM public.users
  WHERE id = p_user_id;
$$;

-- Get user type (bypasses RLS)
CREATE OR REPLACE FUNCTION private.get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_type
  FROM public.users
  WHERE id = p_user_id;
$$;

-- Check if user owns a listing
CREATE OR REPLACE FUNCTION private.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listing_claims
    WHERE listing_id = p_listing_id
    AND owner_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- =====================================================
-- STEP 8: CREATE PUBLIC WRAPPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.get_user_reputation(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.get_user_type(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.user_owns_listing(p_user_id, p_listing_id);
$$;

-- =====================================================
-- STEP 9: CREATE SECURITY QUESTIONS FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION private.hash_security_answer(p_answer TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(lower(trim(p_answer)), gen_salt('bf', 10));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_security_questions(
  p_question_1 TEXT,
  p_answer_1 TEXT,
  p_question_2 TEXT,
  p_answer_2 TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_answer_1)) < 3 OR length(trim(p_answer_2)) < 3 THEN
    RAISE EXCEPTION 'Security answers must be at least 3 characters';
  END IF;

  INSERT INTO public.user_security (
    user_id,
    security_question_1,
    security_answer_1_hash,
    security_question_2,
    security_answer_2_hash,
    updated_at
  ) VALUES (
    v_user_id,
    trim(p_question_1),
    private.hash_security_answer(p_answer_1),
    trim(p_question_2),
    private.hash_security_answer(p_answer_2),
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

CREATE OR REPLACE FUNCTION public.get_security_questions(p_username TEXT)
RETURNS TABLE(question_1 TEXT, question_2 TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    us.security_question_1,
    us.security_question_2
  FROM public.user_security us
  WHERE us.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_security_answers(
  p_username TEXT,
  p_answer_1 TEXT,
  p_answer_2 TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, reset_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_stored_hash_1 TEXT;
  v_stored_hash_2 TEXT;
  v_failed_attempts INTEGER;
  v_locked_until TIMESTAMP WITH TIME ZONE;
  v_reset_token UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT
    security_answer_1_hash,
    security_answer_2_hash,
    us.failed_attempts,
    us.locked_until
  INTO v_stored_hash_1, v_stored_hash_2, v_failed_attempts, v_locked_until
  FROM public.user_security us
  WHERE us.user_id = v_user_id;

  IF v_stored_hash_1 IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Security questions not set'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN QUERY SELECT FALSE,
      format('Account locked. Try again after %s', v_locked_until)::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  IF crypt(lower(trim(p_answer_1)), v_stored_hash_1) = v_stored_hash_1
     AND crypt(lower(trim(p_answer_2)), v_stored_hash_2) = v_stored_hash_2 THEN

    UPDATE public.user_security
    SET failed_attempts = 0, locked_until = NULL
    WHERE user_id = v_user_id;

    v_reset_token := uuid_generate_v4();

    RETURN QUERY SELECT TRUE, 'Verification successful'::TEXT, v_reset_token;
  ELSE
    v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

    UPDATE public.user_security us
    SET
      failed_attempts = v_failed_attempts,
      locked_until = CASE
        WHEN v_failed_attempts >= 5 THEN NOW() + INTERVAL '30 minutes'
        WHEN v_failed_attempts >= 3 THEN NOW() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE us.user_id = v_user_id;

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
-- STEP 10: CREATE TRIGGER FUNCTIONS (BYPASS RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION private.update_user_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_user_id UUID;
  v_new_score INTEGER;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT INTO v_new_score (
    COALESCE((
      SELECT SUM(helpful_votes) * 2
      FROM public.reviews
      WHERE user_id = v_target_user_id
    ), 0) +
    COALESCE((
      SELECT COUNT(*) * 5
      FROM public.facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'verified'
    ), 0) +
    LEAST(
      COALESCE((SELECT COUNT(*) FROM public.reviews WHERE user_id = v_target_user_id), 0) +
      COALESCE((SELECT COUNT(*) FROM public.facts WHERE user_id = v_target_user_id), 0),
      50
    ) -
    COALESCE((
      SELECT COUNT(*) * 3
      FROM public.facts
      WHERE user_id = v_target_user_id
      AND verification_status = 'disputed'
    ), 0)
  );

  v_new_score := GREATEST(COALESCE(v_new_score, 0), 0);

  UPDATE public.users
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

CREATE OR REPLACE FUNCTION private.update_listing_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing_id UUID;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.listings
  SET
    average_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE listing_id = v_listing_id
      AND is_flagged = FALSE
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE listing_id = v_listing_id
      AND is_flagged = FALSE
    )
  WHERE id = v_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =====================================================
-- STEP 11: CREATE TRIGGERS
-- =====================================================

CREATE TRIGGER update_reputation_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_reputation_on_fact_change
AFTER INSERT OR UPDATE OR DELETE ON facts
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_reputation_on_vote_change
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION private.update_user_reputation();

CREATE TRIGGER update_listing_stats_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION private.update_listing_stats();

-- =====================================================
-- STEP 12: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 13: CREATE RLS POLICIES
-- =====================================================

-- ---------------------
-- USERS TABLE POLICIES
-- No subqueries, no function calls - completely flat
-- ---------------------

CREATE POLICY "users_select" ON users
FOR SELECT USING (true);

CREATE POLICY "users_insert" ON users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON users
FOR UPDATE USING (auth.uid() = id);

-- ---------------------
-- USER_SECURITY TABLE POLICIES
-- ---------------------

CREATE POLICY "user_security_select" ON user_security
FOR SELECT USING (auth.uid() = user_id);

-- No direct insert/update - use functions only

-- ---------------------
-- LISTINGS TABLE POLICIES
-- ---------------------

CREATE POLICY "listings_select" ON listings
FOR SELECT USING (true);

CREATE POLICY "listings_insert" ON listings
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "listings_update_creator" ON listings
FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "listings_update_owner" ON listings
FOR UPDATE USING (private.user_owns_listing(auth.uid(), id));

-- ---------------------
-- REVIEWS TABLE POLICIES
-- ---------------------

CREATE POLICY "reviews_select" ON reviews
FOR SELECT USING (true);

CREATE POLICY "reviews_insert" ON reviews
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update" ON reviews
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reviews_delete" ON reviews
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- FACTS TABLE POLICIES
-- ---------------------

CREATE POLICY "facts_select" ON facts
FOR SELECT USING (true);

CREATE POLICY "facts_insert" ON facts
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND private.get_user_reputation(auth.uid()) >= 100
);

CREATE POLICY "facts_update" ON facts
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "facts_delete" ON facts
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- FACT_CHECKS TABLE POLICIES
-- ---------------------

CREATE POLICY "fact_checks_select" ON fact_checks
FOR SELECT USING (true);

CREATE POLICY "fact_checks_insert" ON fact_checks
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fact_checks_update" ON fact_checks
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fact_checks_delete" ON fact_checks
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- LISTING_CLAIMS TABLE POLICIES
-- ---------------------

CREATE POLICY "listing_claims_select" ON listing_claims
FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "listing_claims_insert" ON listing_claims
FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND private.get_user_type(auth.uid()) = 'business_owner'
);

CREATE POLICY "listing_claims_update" ON listing_claims
FOR UPDATE USING (auth.uid() = owner_id);

-- ---------------------
-- RESPONSES TABLE POLICIES
-- ---------------------

CREATE POLICY "responses_select" ON responses
FOR SELECT USING (true);

CREATE POLICY "responses_insert" ON responses
FOR INSERT WITH CHECK (
  auth.uid() = owner_id
  AND private.user_owns_listing(auth.uid(), listing_id)
);

CREATE POLICY "responses_update" ON responses
FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "responses_delete" ON responses
FOR DELETE USING (auth.uid() = owner_id);

-- ---------------------
-- MEDIA_UPLOADS TABLE POLICIES
-- ---------------------

CREATE POLICY "media_uploads_select" ON media_uploads
FOR SELECT USING (true);

CREATE POLICY "media_uploads_insert" ON media_uploads
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "media_uploads_update" ON media_uploads
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "media_uploads_delete" ON media_uploads
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- VOTES TABLE POLICIES
-- ---------------------

CREATE POLICY "votes_select" ON votes
FOR SELECT USING (true);

CREATE POLICY "votes_insert" ON votes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "votes_update" ON votes
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "votes_delete" ON votes
FOR DELETE USING (auth.uid() = user_id);

-- ---------------------
-- SUBSCRIPTIONS TABLE POLICIES
-- ---------------------

CREATE POLICY "subscriptions_select" ON subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert" ON subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_update" ON subscriptions
FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- STEP 14: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation_score);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_listings_entity_type ON listings(entity_type);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_created_by ON listings(created_by);
CREATE INDEX IF NOT EXISTS idx_listings_rating ON listings(average_rating DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facts_listing ON facts(listing_id);
CREATE INDEX IF NOT EXISTS idx_facts_user ON facts(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(verification_status);

CREATE INDEX IF NOT EXISTS idx_fact_checks_fact ON fact_checks(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_checks_user ON fact_checks(user_id);

CREATE INDEX IF NOT EXISTS idx_claims_listing ON listing_claims(listing_id);
CREATE INDEX IF NOT EXISTS idx_claims_owner ON listing_claims(owner_id);
CREATE INDEX IF NOT EXISTS idx_claims_active ON listing_claims(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_responses_listing ON responses(listing_id);
CREATE INDEX IF NOT EXISTS idx_responses_target ON responses(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- =====================================================
-- STEP 15: CREATE UNIQUE CONSTRAINTS
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique
ON votes(user_id, target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_checks_unique
ON fact_checks(user_id, fact_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique
ON reviews(user_id, listing_id);

-- =====================================================
-- STEP 16: GRANT PERMISSIONS
-- =====================================================

-- Revoke direct access to private schema from public
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

-- Grant execute on public functions
GRANT EXECUTE ON FUNCTION public.get_user_reputation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_type(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_security_questions(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_questions(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_answers(TEXT, TEXT, TEXT) TO anon, authenticated;

-- =====================================================
-- STEP 17: VERIFICATION
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

  RAISE NOTICE '✓ Created % RLS policies across % tables', policy_count, table_count;
  RAISE NOTICE '✓ Private schema created for bypass functions';
  RAISE NOTICE '✓ Security questions system ready';
  RAISE NOTICE '✓ All indexes created';
END $$;
