-- =====================================================
-- BİLİNÇ - ROW LEVEL SECURITY POLICIES
-- Run after creating tables
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Check if user is admin
-- =====================================================

CREATE OR REPLACE FUNCTION private.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND user_type = 'admin'
    AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT private.is_admin(p_user_id);
$$;

-- =====================================================
-- HELPER FUNCTION: Check if user created listing
-- =====================================================

CREATE OR REPLACE FUNCTION private.user_created_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = p_listing_id
    AND created_by = p_user_id
  );
$$;

-- =====================================================
-- HELPER FUNCTION: Check if user can manage listing
-- (creator OR verified claim holder)
-- =====================================================

CREATE OR REPLACE FUNCTION private.user_can_manage_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    private.user_created_listing(p_user_id, p_listing_id)
    OR private.user_owns_listing(p_user_id, p_listing_id)
  );
$$;

-- =====================================================
-- CITIES POLICIES (Reference table - public read)
-- =====================================================

CREATE POLICY "cities_select_public" ON cities
  FOR SELECT
  USING (true);

-- Admin only insert/update/delete (via service role or direct DB access)

-- =====================================================
-- DISTRICTS POLICIES (Reference table - public read)
-- =====================================================

CREATE POLICY "districts_select_public" ON districts
  FOR SELECT
  USING (true);

-- =====================================================
-- CATEGORIES POLICIES (Reference table - public read)
-- =====================================================

CREATE POLICY "categories_select_public" ON categories
  FOR SELECT
  USING (true);

-- =====================================================
-- USERS POLICIES
-- =====================================================

-- Anyone can view active users
CREATE POLICY "users_select_public" ON users
  FOR SELECT
  USING (is_active = true);

-- Users can view their own profile even if inactive
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only insert their own profile (during signup)
CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any user
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- USER_SECURITY POLICIES
-- =====================================================

-- Users can only view their own security settings
CREATE POLICY "user_security_select_own" ON user_security
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insert/update handled via security functions only
-- No direct insert/update policies

-- =====================================================
-- LISTINGS POLICIES
-- =====================================================

-- Anyone can view active listings
CREATE POLICY "listings_select_active" ON listings
  FOR SELECT
  USING (status = 'active');

-- Users can view their own listings regardless of status
CREATE POLICY "listings_select_own" ON listings
  FOR SELECT
  USING (auth.uid() = created_by);

-- Claim holders can view their claimed listings
CREATE POLICY "listings_select_claimed" ON listings
  FOR SELECT
  USING (private.user_owns_listing(auth.uid(), id));

-- Admins can view all listings
CREATE POLICY "listings_select_admin" ON listings
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Authenticated users can create listings
CREATE POLICY "listings_insert_auth" ON listings
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
  );

-- Creators can update their own listings
CREATE POLICY "listings_update_creator" ON listings
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Verified claim holders can update listings
CREATE POLICY "listings_update_owner" ON listings
  FOR UPDATE
  USING (private.user_owns_listing(auth.uid(), id));

-- Admins can update any listing
CREATE POLICY "listings_update_admin" ON listings
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- Only admins can delete listings (soft delete via status preferred)
CREATE POLICY "listings_delete_admin" ON listings
  FOR DELETE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- LISTING_CATEGORIES POLICIES
-- =====================================================

-- Anyone can view listing categories
CREATE POLICY "listing_categories_select_public" ON listing_categories
  FOR SELECT
  USING (true);

-- Users who can manage a listing can add categories
CREATE POLICY "listing_categories_insert_manager" ON listing_categories
  FOR INSERT
  WITH CHECK (private.user_can_manage_listing(auth.uid(), listing_id));

-- Users who can manage a listing can update categories
CREATE POLICY "listing_categories_update_manager" ON listing_categories
  FOR UPDATE
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Users who can manage a listing can remove categories
CREATE POLICY "listing_categories_delete_manager" ON listing_categories
  FOR DELETE
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_SOURCES POLICIES (API sync data)
-- =====================================================

-- Anyone can view sources
CREATE POLICY "listing_sources_select_public" ON listing_sources
  FOR SELECT
  USING (true);

-- Only admins can manage sources (populated via API sync scripts)
CREATE POLICY "listing_sources_insert_admin" ON listing_sources
  FOR INSERT
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "listing_sources_update_admin" ON listing_sources
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

CREATE POLICY "listing_sources_delete_admin" ON listing_sources
  FOR DELETE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- LISTING_CONTACTS POLICIES
-- =====================================================

-- Anyone can view contacts
CREATE POLICY "listing_contacts_select_public" ON listing_contacts
  FOR SELECT
  USING (true);

-- Verified claim holders can insert/update contacts
CREATE POLICY "listing_contacts_insert_owner" ON listing_contacts
  FOR INSERT
  WITH CHECK (private.user_owns_listing(auth.uid(), listing_id));

CREATE POLICY "listing_contacts_update_owner" ON listing_contacts
  FOR UPDATE
  USING (private.user_owns_listing(auth.uid(), listing_id));

-- Listing creators can also manage contacts (before claim)
CREATE POLICY "listing_contacts_insert_creator" ON listing_contacts
  FOR INSERT
  WITH CHECK (private.user_created_listing(auth.uid(), listing_id));

CREATE POLICY "listing_contacts_update_creator" ON listing_contacts
  FOR UPDATE
  USING (private.user_created_listing(auth.uid(), listing_id));

-- Admins can manage any contacts
CREATE POLICY "listing_contacts_all_admin" ON listing_contacts
  FOR ALL
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- LISTING_HOURS POLICIES
-- =====================================================

-- Anyone can view hours
CREATE POLICY "listing_hours_select_public" ON listing_hours
  FOR SELECT
  USING (true);

-- Verified claim holders can manage hours
CREATE POLICY "listing_hours_insert_owner" ON listing_hours
  FOR INSERT
  WITH CHECK (private.user_owns_listing(auth.uid(), listing_id));

CREATE POLICY "listing_hours_update_owner" ON listing_hours
  FOR UPDATE
  USING (private.user_owns_listing(auth.uid(), listing_id));

CREATE POLICY "listing_hours_delete_owner" ON listing_hours
  FOR DELETE
  USING (private.user_owns_listing(auth.uid(), listing_id));

-- Listing creators can also manage hours
CREATE POLICY "listing_hours_insert_creator" ON listing_hours
  FOR INSERT
  WITH CHECK (private.user_created_listing(auth.uid(), listing_id));

CREATE POLICY "listing_hours_update_creator" ON listing_hours
  FOR UPDATE
  USING (private.user_created_listing(auth.uid(), listing_id));

CREATE POLICY "listing_hours_delete_creator" ON listing_hours
  FOR DELETE
  USING (private.user_created_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_PHOTOS POLICIES
-- =====================================================

-- Anyone can view active photos
CREATE POLICY "listing_photos_select_active" ON listing_photos
  FOR SELECT
  USING (status = 'active');

-- Listing managers can see all photos (including pending)
CREATE POLICY "listing_photos_select_manager" ON listing_photos
  FOR SELECT
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Authenticated users can upload photos
CREATE POLICY "listing_photos_insert_auth" ON listing_photos
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = uploaded_by
  );

-- Users can delete their own uploads
CREATE POLICY "listing_photos_delete_own" ON listing_photos
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Listing managers can delete any photo on their listing
CREATE POLICY "listing_photos_delete_manager" ON listing_photos
  FOR DELETE
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Listing managers can update photos (approve, set primary, etc.)
CREATE POLICY "listing_photos_update_manager" ON listing_photos
  FOR UPDATE
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_CLAIMS POLICIES
-- =====================================================

-- Users can view their own claims
CREATE POLICY "listing_claims_select_own" ON listing_claims
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all claims
CREATE POLICY "listing_claims_select_admin" ON listing_claims
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Business owners can create claims
CREATE POLICY "listing_claims_insert_business" ON listing_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND private.get_user_type(auth.uid()) = 'business_owner'
  );

-- Users can update their own pending claims (add documents, etc.)
CREATE POLICY "listing_claims_update_own_pending" ON listing_claims
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- Admins can update any claim (verify, reject, etc.)
CREATE POLICY "listing_claims_update_admin" ON listing_claims
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- Users can delete their own pending claims (withdraw)
CREATE POLICY "listing_claims_delete_own_pending" ON listing_claims
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- =====================================================
-- LISTING_EDITS POLICIES
-- =====================================================

-- Anyone can view approved edits
CREATE POLICY "listing_edits_select_approved" ON listing_edits
  FOR SELECT
  USING (status IN ('approved', 'auto_approved'));

-- Users can view their own edits
CREATE POLICY "listing_edits_select_own" ON listing_edits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Listing managers can view all edits for their listings
CREATE POLICY "listing_edits_select_manager" ON listing_edits
  FOR SELECT
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Admins can view all edits
CREATE POLICY "listing_edits_select_admin" ON listing_edits
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Authenticated users can submit edits
CREATE POLICY "listing_edits_insert_auth" ON listing_edits
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Listing managers can review edits (approve/reject)
CREATE POLICY "listing_edits_update_manager" ON listing_edits
  FOR UPDATE
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Admins can update any edit
CREATE POLICY "listing_edits_update_admin" ON listing_edits
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

-- Anyone can view active reviews
CREATE POLICY "reviews_select_active" ON reviews
  FOR SELECT
  USING (status = 'active');

-- Users can view their own reviews
CREATE POLICY "reviews_select_own" ON reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- Listing managers can view all reviews (including hidden)
CREATE POLICY "reviews_select_manager" ON reviews
  FOR SELECT
  USING (private.user_can_manage_listing(auth.uid(), listing_id));

-- Admins can view all reviews
CREATE POLICY "reviews_select_admin" ON reviews
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Authenticated users can create reviews
CREATE POLICY "reviews_insert_auth" ON reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Users can update their own reviews
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can update any review (moderate)
CREATE POLICY "reviews_update_admin" ON reviews
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- Admins can delete any review
CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- REVIEW_PHOTOS POLICIES
-- =====================================================

-- Anyone can view photos of active reviews
CREATE POLICY "review_photos_select_public" ON review_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND reviews.status = 'active'
    )
  );

-- Review authors can manage their photos
CREATE POLICY "review_photos_insert_author" ON review_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND reviews.user_id = auth.uid()
    )
  );

CREATE POLICY "review_photos_delete_author" ON review_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND reviews.user_id = auth.uid()
    )
  );

CREATE POLICY "review_photos_update_author" ON review_photos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND reviews.user_id = auth.uid()
    )
  );

-- =====================================================
-- REVIEW_VOTES POLICIES
-- =====================================================

-- Anyone can view vote counts (via aggregate)
CREATE POLICY "review_votes_select_public" ON review_votes
  FOR SELECT
  USING (true);

-- Authenticated users can vote
CREATE POLICY "review_votes_insert_auth" ON review_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Users can change their vote
CREATE POLICY "review_votes_update_own" ON review_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their vote
CREATE POLICY "review_votes_delete_own" ON review_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- REVIEW_RESPONSES POLICIES
-- =====================================================

-- Anyone can view responses
CREATE POLICY "review_responses_select_public" ON review_responses
  FOR SELECT
  USING (true);

-- Verified listing owners can respond
CREATE POLICY "review_responses_insert_owner" ON review_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND private.user_owns_listing(auth.uid(), listing_id)
  );

-- Response authors can update their responses
CREATE POLICY "review_responses_update_own" ON review_responses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Response authors can delete their responses
CREATE POLICY "review_responses_delete_own" ON review_responses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can manage any response
CREATE POLICY "review_responses_all_admin" ON review_responses
  FOR ALL
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- FACTS POLICIES
-- =====================================================

-- Anyone can view non-retracted facts
CREATE POLICY "facts_select_public" ON facts
  FOR SELECT
  USING (verification_status != 'retracted');

-- Users can view their own facts
CREATE POLICY "facts_select_own" ON facts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all facts
CREATE POLICY "facts_select_admin" ON facts
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Users with reputation >= 100 can create facts
CREATE POLICY "facts_insert_qualified" ON facts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND private.get_user_reputation(auth.uid()) >= 100
  );

-- Users can update their own facts
CREATE POLICY "facts_update_own" ON facts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own facts
CREATE POLICY "facts_delete_own" ON facts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can update any fact
CREATE POLICY "facts_update_admin" ON facts
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- FACT_CHECKS POLICIES
-- =====================================================

-- Anyone can view fact checks
CREATE POLICY "fact_checks_select_public" ON fact_checks
  FOR SELECT
  USING (true);

-- Authenticated users can check facts
CREATE POLICY "fact_checks_insert_auth" ON fact_checks
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Users can update their own checks
CREATE POLICY "fact_checks_update_own" ON fact_checks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own checks
CREATE POLICY "fact_checks_delete_own" ON fact_checks
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- FACT_VOTES POLICIES
-- =====================================================

-- Anyone can view votes
CREATE POLICY "fact_votes_select_public" ON fact_votes
  FOR SELECT
  USING (true);

-- Authenticated users can vote
CREATE POLICY "fact_votes_insert_auth" ON fact_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Users can change their vote
CREATE POLICY "fact_votes_update_own" ON fact_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their vote
CREATE POLICY "fact_votes_delete_own" ON fact_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- FACT_RESPONSES POLICIES
-- =====================================================

-- Anyone can view responses
CREATE POLICY "fact_responses_select_public" ON fact_responses
  FOR SELECT
  USING (true);

-- Verified listing owners can respond
CREATE POLICY "fact_responses_insert_owner" ON fact_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND private.user_owns_listing(auth.uid(), listing_id)
  );

-- Response authors can update their responses
CREATE POLICY "fact_responses_update_own" ON fact_responses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Response authors can delete their responses
CREATE POLICY "fact_responses_delete_own" ON fact_responses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can manage any response
CREATE POLICY "fact_responses_all_admin" ON fact_responses
  FOR ALL
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

-- Users can view their own subscriptions
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "subscriptions_select_admin" ON subscriptions
  FOR SELECT
  USING (private.is_admin(auth.uid()));

-- Users can create their own subscription
CREATE POLICY "subscriptions_insert_own" ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription (cancel, etc.)
CREATE POLICY "subscriptions_update_own" ON subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any subscription
CREATE POLICY "subscriptions_update_admin" ON subscriptions
  FOR UPDATE
  USING (private.is_admin(auth.uid()));

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Revoke direct access to private schema
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

-- Grant execute on public wrapper functions
GRANT EXECUTE ON FUNCTION public.get_user_reputation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_type(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_security_questions(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_questions(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_answers(TEXT, TEXT, TEXT) TO anon, authenticated;

-- =====================================================
-- SERVICE ROLE BYPASS (for API sync, admin tasks)
-- =====================================================

-- Create a function to check if running as service role
CREATE OR REPLACE FUNCTION private.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('role', true) = 'service_role';
$$;

-- Add service role bypass to listing_sources for API sync
DROP POLICY IF EXISTS "listing_sources_insert_admin" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_update_admin" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_delete_admin" ON listing_sources;

CREATE POLICY "listing_sources_insert_service" ON listing_sources
  FOR INSERT
  WITH CHECK (
    private.is_admin(auth.uid())
    OR private.is_service_role()
  );

CREATE POLICY "listing_sources_update_service" ON listing_sources
  FOR UPDATE
  USING (
    private.is_admin(auth.uid())
    OR private.is_service_role()
  );

CREATE POLICY "listing_sources_delete_service" ON listing_sources
  FOR DELETE
  USING (
    private.is_admin(auth.uid())
    OR private.is_service_role()
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND rowsecurity = true;

  RAISE NOTICE '✓ RLS Policies created: %', policy_count;
  RAISE NOTICE '✓ Tables with RLS enabled: %', table_count;
END $$;
