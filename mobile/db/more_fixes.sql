-- =====================================================
-- FIX: Make public wrappers SECURITY DEFINER
-- This is the secure way to do it
-- =====================================================

-- Drop and recreate with correct security
CREATE OR REPLACE FUNCTION public.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- ← Changed from INVOKER
STABLE
AS $$
  SELECT private.user_owns_listing(p_user_id, p_listing_id);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- ← Changed from INVOKER
STABLE
AS $$
  SELECT private.is_admin(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_reputation(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER  -- ← Changed from INVOKER
STABLE
AS $$
  SELECT private.get_user_reputation(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_type(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER  -- ← Changed from INVOKER
STABLE
AS $$
  SELECT private.get_user_type(p_user_id);
$$;

-- ADD missing public wrappers:
CREATE OR REPLACE FUNCTION public.user_created_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT private.user_created_listing(p_user_id, p_listing_id);
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT private.user_can_manage_listing(p_user_id, p_listing_id);
$$;

-- Grant execute on PUBLIC wrappers only
GRANT EXECUTE ON FUNCTION public.user_owns_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_reputation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_type(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_created_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_listing(UUID, UUID) TO authenticated;

-- Ensure private functions have NO public access
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM anon;

-- =====================================================
-- RLS POLICY FIXES: Change private.* to public.*
-- Run this AFTER the public wrapper fix
-- =====================================================

-- =====================================================
-- USERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "users_update_admin" ON users;
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- LISTINGS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listings_select_claimed" ON listings;
CREATE POLICY "listings_select_claimed" ON listings
  FOR SELECT
  USING (public.user_owns_listing(auth.uid(), id));

DROP POLICY IF EXISTS "listings_select_admin" ON listings;
CREATE POLICY "listings_select_admin" ON listings
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "listings_update_owner" ON listings;
CREATE POLICY "listings_update_owner" ON listings
  FOR UPDATE
  USING (public.user_owns_listing(auth.uid(), id));

DROP POLICY IF EXISTS "listings_update_admin" ON listings;
CREATE POLICY "listings_update_admin" ON listings
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "listings_delete_admin" ON listings;
CREATE POLICY "listings_delete_admin" ON listings
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- LISTING_CATEGORIES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_categories_insert_manager" ON listing_categories;
CREATE POLICY "listing_categories_insert_manager" ON listing_categories
  FOR INSERT
  WITH CHECK (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_categories_update_manager" ON listing_categories;
CREATE POLICY "listing_categories_update_manager" ON listing_categories
  FOR UPDATE
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_categories_delete_manager" ON listing_categories;
CREATE POLICY "listing_categories_delete_manager" ON listing_categories
  FOR DELETE
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_SOURCES POLICIES
-- =====================================================


-- Add public wrapper for is_service_role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT private.is_service_role();
$$;

GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, anon;

DROP POLICY IF EXISTS "listing_sources_insert_service" ON listing_sources;
CREATE POLICY "listing_sources_insert_service" ON listing_sources
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_service_role()
  );

DROP POLICY IF EXISTS "listing_sources_update_service" ON listing_sources;
CREATE POLICY "listing_sources_update_service" ON listing_sources
  FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR public.is_service_role()
  );

DROP POLICY IF EXISTS "listing_sources_delete_service" ON listing_sources;
CREATE POLICY "listing_sources_delete_service" ON listing_sources
  FOR DELETE
  USING (
    public.is_admin(auth.uid())
    OR public.is_service_role()
  );

-- =====================================================
-- LISTING_CONTACTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_contacts_insert_owner" ON listing_contacts;
CREATE POLICY "listing_contacts_insert_owner" ON listing_contacts
  FOR INSERT
  WITH CHECK (public.user_owns_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_contacts_update_owner" ON listing_contacts;
CREATE POLICY "listing_contacts_update_owner" ON listing_contacts
  FOR UPDATE
  USING (public.user_owns_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_contacts_insert_creator" ON listing_contacts;
CREATE POLICY "listing_contacts_insert_creator" ON listing_contacts
  FOR INSERT
  WITH CHECK (public.user_created_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_contacts_update_creator" ON listing_contacts;
CREATE POLICY "listing_contacts_update_creator" ON listing_contacts
  FOR UPDATE
  USING (public.user_created_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_contacts_all_admin" ON listing_contacts;
CREATE POLICY "listing_contacts_all_admin" ON listing_contacts
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- LISTING_HOURS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_hours_insert_owner" ON listing_hours;
CREATE POLICY "listing_hours_insert_owner" ON listing_hours
  FOR INSERT
  WITH CHECK (public.user_owns_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_hours_update_owner" ON listing_hours;
CREATE POLICY "listing_hours_update_owner" ON listing_hours
  FOR UPDATE
  USING (public.user_owns_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_hours_delete_owner" ON listing_hours;
CREATE POLICY "listing_hours_delete_owner" ON listing_hours
  FOR DELETE
  USING (public.user_owns_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_hours_insert_creator" ON listing_hours;
CREATE POLICY "listing_hours_insert_creator" ON listing_hours
  FOR INSERT
  WITH CHECK (public.user_created_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_hours_update_creator" ON listing_hours;
CREATE POLICY "listing_hours_update_creator" ON listing_hours
  FOR UPDATE
  USING (public.user_created_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_hours_delete_creator" ON listing_hours;
CREATE POLICY "listing_hours_delete_creator" ON listing_hours
  FOR DELETE
  USING (public.user_created_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_PHOTOS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_photos_select_manager" ON listing_photos;
CREATE POLICY "listing_photos_select_manager" ON listing_photos
  FOR SELECT
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_photos_delete_manager" ON listing_photos;
CREATE POLICY "listing_photos_delete_manager" ON listing_photos
  FOR DELETE
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_photos_update_manager" ON listing_photos;
CREATE POLICY "listing_photos_update_manager" ON listing_photos
  FOR UPDATE
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

-- =====================================================
-- LISTING_CLAIMS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_claims_select_admin" ON listing_claims;
CREATE POLICY "listing_claims_select_admin" ON listing_claims
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "listing_claims_insert_business" ON listing_claims;
CREATE POLICY "listing_claims_insert_business" ON listing_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.get_user_type(auth.uid()) = 'business_owner'
  );

DROP POLICY IF EXISTS "listing_claims_update_admin" ON listing_claims;
CREATE POLICY "listing_claims_update_admin" ON listing_claims
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- LISTING_EDITS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "listing_edits_select_manager" ON listing_edits;
CREATE POLICY "listing_edits_select_manager" ON listing_edits
  FOR SELECT
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_edits_select_admin" ON listing_edits;
CREATE POLICY "listing_edits_select_admin" ON listing_edits
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "listing_edits_update_manager" ON listing_edits;
CREATE POLICY "listing_edits_update_manager" ON listing_edits
  FOR UPDATE
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "listing_edits_update_admin" ON listing_edits;
CREATE POLICY "listing_edits_update_admin" ON listing_edits
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "reviews_select_manager" ON reviews;
CREATE POLICY "reviews_select_manager" ON reviews
  FOR SELECT
  USING (public.user_can_manage_listing(auth.uid(), listing_id));

DROP POLICY IF EXISTS "reviews_select_admin" ON reviews;
CREATE POLICY "reviews_select_admin" ON reviews
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "reviews_update_admin" ON reviews;
CREATE POLICY "reviews_update_admin" ON reviews
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "reviews_delete_admin" ON reviews;
CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- REVIEW_RESPONSES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "review_responses_insert_owner" ON review_responses;
CREATE POLICY "review_responses_insert_owner" ON review_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_owns_listing(auth.uid(), listing_id)
  );

DROP POLICY IF EXISTS "review_responses_all_admin" ON review_responses;
CREATE POLICY "review_responses_all_admin" ON review_responses
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- FACTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "facts_select_admin" ON facts;
CREATE POLICY "facts_select_admin" ON facts
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "facts_insert_qualified" ON facts;
CREATE POLICY "facts_insert_qualified" ON facts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.get_user_reputation(auth.uid()) >= 100
  );

DROP POLICY IF EXISTS "facts_update_admin" ON facts;
CREATE POLICY "facts_update_admin" ON facts
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- FACT_RESPONSES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "fact_responses_insert_owner" ON fact_responses;
CREATE POLICY "fact_responses_insert_owner" ON fact_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_owns_listing(auth.uid(), listing_id)
  );

DROP POLICY IF EXISTS "fact_responses_all_admin" ON fact_responses;
CREATE POLICY "fact_responses_all_admin" ON fact_responses
  FOR ALL
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "subscriptions_select_admin" ON subscriptions;
CREATE POLICY "subscriptions_select_admin" ON subscriptions
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "subscriptions_update_admin" ON subscriptions;
CREATE POLICY "subscriptions_update_admin" ON subscriptions
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  policies_using_private INTEGER;
BEGIN
  -- Check if any policies still reference private schema
  SELECT COUNT(*) INTO policies_using_private
  FROM pg_policies
  WHERE schemaname = 'public'
  AND (qual LIKE '%private.%' OR with_check LIKE '%private.%');

  IF policies_using_private > 0 THEN
    RAISE WARNING '⚠️  % policies still reference private schema!', policies_using_private;
  ELSE
    RAISE NOTICE '✅ All policies now use public functions';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  RLS POLICY UPDATE COMPLETE';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  44 policies updated to use public.* functions';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;




-- =====================================================
-- FIX: AMBIGUOUS COLUMN REFERENCES
-- =====================================================

-- 1. FIX browse_category
CREATE OR REPLACE FUNCTION public.browse_category(
  p_category_slug TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_classification TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'rating',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_id UUID,
  parent_name TEXT,
  city_name TEXT,
  district_name TEXT,
  category_slug TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get category ID (use table alias to avoid ambiguity)
  SELECT cat.id INTO v_category_id
  FROM categories cat
  WHERE cat.slug = p_category_slug;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', p_category_slug;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END AS classification,
    l.parent_id,
    parent.name AS parent_name,
    ci.name AS city_name,
    d.name AS district_name,
    cat_match.slug AS category_slug,
    cat_match.name AS category_name,
    l.average_rating,
    l.total_reviews,
    (SELECT lp.url FROM listing_photos lp WHERE lp.listing_id = l.id AND lp.is_primary = true AND lp.status = 'active' LIMIT 1)
  FROM listings l
  JOIN listing_categories lc ON lc.listing_id = l.id
  LEFT JOIN categories cat_match ON cat_match.id = lc.category_id
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities ci ON ci.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  WHERE l.status = 'active'
    AND (
      lc.category_id = v_category_id
      -- FIX: Use table alias in subquery
      OR lc.category_id IN (SELECT cat_sub.id FROM categories cat_sub WHERE cat_sub.parent_id = v_category_id)
    )
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    AND (
      p_classification IS NULL
      OR (p_classification = 'company' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL)
      OR (p_classification = 'standalone' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL)
      OR (p_classification = 'branch' AND l.entity_type = 'business' AND l.parent_id IS NOT NULL)
      OR (p_classification = 'brand' AND l.entity_type = 'brand')
      OR (p_classification = 'product' AND l.entity_type = 'product')
    )
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
    AND (p_min_rating IS NULL OR l.average_rating >= p_min_rating)
  ORDER BY
    CASE WHEN p_sort_by = 'rating' THEN l.average_rating END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'reviews' THEN l.total_reviews END DESC,
    CASE WHEN p_sort_by = 'newest' THEN l.created_at END DESC,
    l.total_reviews DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- 2. FIX get_category_counts
CREATE OR REPLACE FUNCTION public.get_category_counts(
  p_category_slug TEXT
)
RETURNS TABLE (
  classification TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH category_listings AS (
    SELECT l.*
    FROM listings l
    JOIN listing_categories lc ON lc.listing_id = l.id
    JOIN categories cat ON cat.id = lc.category_id
    WHERE (
      cat.slug = p_category_slug
      OR cat.parent_id = (SELECT cat_sub.id FROM categories cat_sub WHERE cat_sub.slug = p_category_slug)
    )
    AND l.status = 'active'
  )
  SELECT
    CASE
      WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NULL THEN 'company'
      WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NOT NULL THEN 'standalone'
      WHEN entity_type = 'business' AND parent_id IS NOT NULL THEN 'branch'
      WHEN entity_type = 'brand' THEN 'brand'
      WHEN entity_type = 'product' THEN 'product'
    END AS classification,
    COUNT(*) AS count
  FROM category_listings
  GROUP BY 1
  ORDER BY count DESC;
$$;


-- 3. FIX search_listings
CREATE OR REPLACE FUNCTION public.search_listings(
  p_query TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_classification TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_has_reviews BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_id UUID,
  parent_name TEXT,
  parent_slug TEXT,
  city_code CHAR(2),
  city_name TEXT,
  district_name TEXT,
  category_slug TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.description,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END::TEXT AS classification,
    l.parent_id,
    parent.name AS parent_name,
    parent.slug AS parent_slug,
    l.city_code,
    ci.name AS city_name,
    d.name AS district_name,
    cat.slug AS category_slug,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    (SELECT lp.url FROM listing_photos lp WHERE lp.listing_id = l.id AND lp.is_primary = true AND lp.status = 'active' LIMIT 1),
    CASE
      WHEN p_query IS NOT NULL AND p_query != ''
      THEN ts_rank(l.search_vector, websearch_to_tsquery('turkish', p_query))
      ELSE 1.0
    END AS rank
  FROM listings l
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities ci ON ci.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    AND (
      p_query IS NULL
      OR p_query = ''
      OR l.search_vector @@ websearch_to_tsquery('turkish', p_query)
    )
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    AND (
      p_classification IS NULL
      OR (p_classification = 'company' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL)
      OR (p_classification = 'standalone' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL)
      OR (p_classification = 'branch' AND l.entity_type = 'business' AND l.parent_id IS NOT NULL)
      OR (p_classification = 'brand' AND l.entity_type = 'brand')
      OR (p_classification = 'product' AND l.entity_type = 'product')
    )
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
    AND (p_category_slug IS NULL OR cat.slug = p_category_slug)
    AND (p_parent_id IS NULL OR l.parent_id = p_parent_id)
    AND (p_min_rating IS NULL OR l.average_rating >= p_min_rating)
    AND (p_has_reviews IS NULL OR (p_has_reviews = true AND l.total_reviews > 0) OR (p_has_reviews = false))
  ORDER BY
    rank DESC,
    l.average_rating DESC NULLS LAST,
    l.total_reviews DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- 4. FIX search_suggestions
CREATE OR REPLACE FUNCTION public.search_suggestions(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_name TEXT,
  category_name TEXT,
  city_name TEXT,
  match_type TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query TEXT;
BEGIN
  v_query := lower(trim(p_query));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (l.id)
    l.id,
    l.name,
    l.slug,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END::TEXT AS classification,
    parent.name AS parent_name,
    cat.name AS category_name,
    ci.name AS city_name,
    CASE
      WHEN lower(l.name) = v_query THEN 'exact'
      WHEN lower(l.name) LIKE v_query || '%' THEN 'prefix'
      ELSE 'contains'
    END AS match_type
  FROM listings l
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  LEFT JOIN cities ci ON ci.code = l.city_code
  WHERE l.status = 'active'
    AND (
      lower(l.name) LIKE '%' || v_query || '%'
      OR l.search_vector @@ to_tsquery('turkish', v_query || ':*')
    )
  ORDER BY
    l.id,
    CASE
      WHEN lower(l.name) = v_query THEN 1
      WHEN lower(l.name) LIKE v_query || '%' THEN 2
      ELSE 3
    END,
    l.total_reviews DESC
  LIMIT p_limit;
END;
$$;


-- 5. FIX get_categories_for_type
CREATE OR REPLACE FUNCTION public.get_categories_for_type(
  p_entity_type TEXT,
  p_parent_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  name_en TEXT,
  icon TEXT,
  parent_id UUID,
  parent_slug TEXT,
  parent_name TEXT,
  listing_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    cat.id,
    cat.slug,
    cat.name,
    cat.name_en,
    cat.icon,
    cat.parent_id,
    pc.slug AS parent_slug,
    pc.name AS parent_name,
    (
      SELECT COUNT(DISTINCT lc.listing_id)
      FROM listing_categories lc
      JOIN listings l ON l.id = lc.listing_id
      WHERE lc.category_id = cat.id
      AND l.status = 'active'
      AND l.entity_type = p_entity_type
    ) AS listing_count
  FROM categories cat
  LEFT JOIN categories pc ON pc.id = cat.parent_id
  WHERE p_entity_type = ANY(cat.allowed_types)
    AND (NOT p_parent_only OR cat.parent_id IS NULL)
  ORDER BY cat.sort_order, cat.name;
$$;


-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed ambiguous column references in:';
  RAISE NOTICE '   - browse_category()';
  RAISE NOTICE '   - get_category_counts()';
  RAISE NOTICE '   - search_listings()';
  RAISE NOTICE '   - search_suggestions()';
  RAISE NOTICE '   - get_categories_for_type()';
END $$;
