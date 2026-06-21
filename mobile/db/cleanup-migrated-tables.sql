-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!                                                               !!
-- !!  WARNING: DESTRUCTIVE MIGRATION — READ BEFORE RUNNING         !!
-- !!                                                               !!
-- !!  This script drops tables, views, functions, and deletes      !!
-- !!  bulk listing data from Supabase. It is IRREVERSIBLE.         !!
-- !!                                                               !!
-- !!  ONLY RUN AFTER VERIFYING:                                    !!
-- !!    1. DynamoDB has all catalog data (item count matches)       !!
-- !!    2. Turso search index returns correct results               !!
-- !!    3. App works end-to-end with hybrid backends                !!
-- !!    4. Scrapers write to DynamoDB + Turso (not Supabase)        !!
-- !!                                                               !!
-- !!  This script is idempotent — safe to run multiple times.      !!
-- !!                                                               !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

BEGIN;

-- =====================================================
-- PHASE 1: DROP SATELLITE TABLES
-- Data now embedded in DynamoDB listing items
-- =====================================================

-- Drop RLS policies first (policies reference these tables)
-- listing_sources policies
DROP POLICY IF EXISTS "listing_sources_select_public" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_insert_admin" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_update_admin" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_delete_admin" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_insert_service" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_update_service" ON listing_sources;
DROP POLICY IF EXISTS "listing_sources_delete_service" ON listing_sources;

-- listing_photos policies
DROP POLICY IF EXISTS "listing_photos_select_active" ON listing_photos;
DROP POLICY IF EXISTS "listing_photos_select_manager" ON listing_photos;
DROP POLICY IF EXISTS "listing_photos_insert_auth" ON listing_photos;
DROP POLICY IF EXISTS "listing_photos_delete_own" ON listing_photos;
DROP POLICY IF EXISTS "listing_photos_delete_manager" ON listing_photos;
DROP POLICY IF EXISTS "listing_photos_update_manager" ON listing_photos;

-- listing_hours policies
DROP POLICY IF EXISTS "listing_hours_select_public" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_insert_owner" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_update_owner" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_delete_owner" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_insert_creator" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_update_creator" ON listing_hours;
DROP POLICY IF EXISTS "listing_hours_delete_creator" ON listing_hours;

-- listing_contacts policies
DROP POLICY IF EXISTS "listing_contacts_select_public" ON listing_contacts;
DROP POLICY IF EXISTS "listing_contacts_insert_owner" ON listing_contacts;
DROP POLICY IF EXISTS "listing_contacts_update_owner" ON listing_contacts;
DROP POLICY IF EXISTS "listing_contacts_insert_creator" ON listing_contacts;
DROP POLICY IF EXISTS "listing_contacts_update_creator" ON listing_contacts;
DROP POLICY IF EXISTS "listing_contacts_all_admin" ON listing_contacts;

-- listing_categories policies
DROP POLICY IF EXISTS "listing_categories_select_public" ON listing_categories;
DROP POLICY IF EXISTS "listing_categories_insert_manager" ON listing_categories;
DROP POLICY IF EXISTS "listing_categories_update_manager" ON listing_categories;
DROP POLICY IF EXISTS "listing_categories_delete_manager" ON listing_categories;

-- Now drop the tables (CASCADE handles FK constraints, indexes, triggers)
DROP TABLE IF EXISTS listing_sources CASCADE;
DROP TABLE IF EXISTS listing_photos CASCADE;
DROP TABLE IF EXISTS listing_hours CASCADE;
DROP TABLE IF EXISTS listing_contacts CASCADE;
DROP TABLE IF EXISTS listing_categories CASCADE;

-- =====================================================
-- PHASE 2: DROP VIEWS THAT DEPEND ON LISTINGS
-- =====================================================

-- Materialized views (from fixes.sql — company_stats replaced brand_product_stats)
DROP MATERIALIZED VIEW IF EXISTS company_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS brand_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS brand_product_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS category_stats CASCADE;

-- Regular views
DROP VIEW IF EXISTS listing_full CASCADE;
DROP VIEW IF EXISTS listing_claim_status CASCADE;
DROP VIEW IF EXISTS listing_classification CASCADE;

-- =====================================================
-- PHASE 3: DELETE BULK CATALOG ROWS FROM LISTINGS
-- Keep only rows referenced by user-generated content
-- (reviews, facts, claims, edits, responses)
-- =====================================================

DELETE FROM listings
WHERE id NOT IN (
    SELECT DISTINCT listing_id FROM reviews
    UNION
    SELECT DISTINCT listing_id FROM facts
    UNION
    SELECT DISTINCT listing_id FROM listing_claims
    UNION
    SELECT DISTINCT listing_id FROM listing_edits
    UNION
    SELECT DISTINCT listing_id FROM review_responses
    UNION
    SELECT DISTINCT listing_id FROM fact_responses
);

-- =====================================================
-- PHASE 4: DROP SEARCH-RELATED COLUMNS FROM LISTINGS
-- =====================================================

-- Drop the search vector trigger first
DROP TRIGGER IF EXISTS listings_search_vector_update ON listings;

-- Drop the search vector column
ALTER TABLE listings DROP COLUMN IF EXISTS search_vector;

-- =====================================================
-- PHASE 5: DROP FUNCTIONS REPLACED BY DynamoDB/Turso
-- Using CASCADE to also drop any dependent triggers/grants
-- =====================================================

-- Search functions (now handled by Turso FTS5)
-- search_listings has multiple overloaded signatures from different files
DROP FUNCTION IF EXISTS public.search_listings(TEXT, TEXT, TEXT, CHAR, TEXT, UUID, NUMERIC, BOOLEAN, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.search_listings(TEXT, TEXT, CHAR, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.search_suggestions(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.search_nearby(NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, NUMERIC, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_nearby_listings(NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER) CASCADE;

-- Category/browse functions (now handled by DynamoDB GSIs)
DROP FUNCTION IF EXISTS public.browse_category(TEXT, TEXT, TEXT, CHAR, NUMERIC, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_category_counts(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_categories_for_type(TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.get_category_tree() CASCADE;

-- Listing detail/hierarchy functions (now handled by DynamoDB)
DROP FUNCTION IF EXISTS public.get_brand_products(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_overview(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_branches(UUID, CHAR) CASCADE;
DROP FUNCTION IF EXISTS public.get_listing_breadcrumb(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_trending_listings(TEXT, CHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_explore_data(CHAR) CASCADE;

-- Materialized view refresh (views are dropped)
DROP FUNCTION IF EXISTS public.refresh_materialized_views() CASCADE;

-- Listing utility functions (no longer needed without full catalog)
DROP FUNCTION IF EXISTS public.get_listing_url(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.generate_slug(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_listing_slug() CASCADE;
DROP FUNCTION IF EXISTS public.update_listing_search_vector() CASCADE;
DROP FUNCTION IF EXISTS public.validate_listing_hierarchy() CASCADE;
DROP FUNCTION IF EXISTS public.validate_listing_category() CASCADE;

-- =====================================================
-- PHASE 6: DROP LISTING_NAME TRIGGERS
-- These were added in hybrid-migration.sql to auto-populate
-- listing_name on review/fact inserts from the listings table.
-- After cleanup, listings is a thin FK reference table —
-- the app must populate listing_name before inserting.
-- =====================================================

DROP TRIGGER IF EXISTS reviews_set_listing_name ON reviews;
DROP TRIGGER IF EXISTS facts_set_listing_name ON facts;
DROP FUNCTION IF EXISTS public.set_listing_name_on_review() CASCADE;
DROP FUNCTION IF EXISTS public.set_listing_name_on_fact() CASCADE;

-- =====================================================
-- PHASE 7: DROP REMAINING LISTING-SPECIFIC TRIGGERS
-- =====================================================

-- Auto-slug trigger (no longer needed — slugs live in DynamoDB)
DROP TRIGGER IF EXISTS listings_auto_slug ON listings;

-- Hierarchy validation trigger (entity hierarchy lives in DynamoDB)
DROP TRIGGER IF EXISTS listings_validate_hierarchy ON listings;

-- updated_at triggers on dropped tables
-- (listing_contacts already dropped via CASCADE, but explicit for clarity)
DROP TRIGGER IF EXISTS listing_contacts_updated_at ON listing_contacts;

-- =====================================================
-- PHASE 8: DROP UNUSED LISTING INDEXES
-- Keep only what remains on the trimmed listings table
-- =====================================================

-- These indexes reference columns/patterns for the full catalog
-- and are no longer useful on the small FK-reference table
DROP INDEX IF EXISTS idx_listings_search;
DROP INDEX IF EXISTS idx_listings_location;
DROP INDEX IF EXISTS idx_listings_status_type;
DROP INDEX IF EXISTS idx_listings_type;
DROP INDEX IF EXISTS idx_listings_city;
DROP INDEX IF EXISTS idx_listings_district;
DROP INDEX IF EXISTS idx_listings_parent;
DROP INDEX IF EXISTS idx_listings_rating;

-- Keep: idx_listings_slug (FK lookups), idx_listings_status,
--       idx_listings_created_by (still relevant for remaining rows)

-- =====================================================
-- FUNCTIONS & TRIGGERS THAT REMAIN (DO NOT DROP)
-- =====================================================
--
-- USER CONTENT (reviews, facts, votes — still in Supabase):
--   - get_user_profile(UUID)
--   - get_listing_stats(UUID)
--   - get_admin_stats()
--   - update_listing_stats() trigger (updates listings.average_rating)
--   - update_review_helpful_count() trigger
--   - update_fact_helpful_count() trigger
--   - update_fact_verification_status() trigger
--   - auto_approve_trusted_edits() trigger
--   - apply_approved_edit() trigger
--   - prevent_self_review() trigger
--   - prevent_self_vote_review() trigger
--   - prevent_self_vote_fact() trigger
--   - update_updated_at() trigger (on reviews, facts, etc.)
--
-- REPUTATION:
--   - private.update_user_reputation() + all 4 triggers
--
-- SECURITY:
--   - set_security_questions()
--   - get_security_questions()
--   - verify_security_answers()
--   - private.hash_security_answer()
--   - private.is_admin() / public.is_admin()
--   - private.get_user_reputation() / public.get_user_reputation()
--   - private.get_user_type() / public.get_user_type()
--   - private.user_owns_listing() / public.user_owns_listing()
--   - private.user_created_listing() / public.user_created_listing()
--   - private.user_can_manage_listing() / public.user_can_manage_listing()
--   - private.is_service_role() / public.is_service_role()
--
-- ALL RLS POLICIES on remaining tables are untouched.
-- =====================================================

COMMIT;

-- =====================================================
-- VERIFICATION (outside transaction)
-- =====================================================

DO $$
DECLARE
  remaining_listings BIGINT;
  table_count INTEGER;
  remaining_functions INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_listings FROM listings;

  SELECT COUNT(*) INTO table_count
  FROM pg_tables WHERE schemaname = 'public';

  SELECT COUNT(*) INTO remaining_functions
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';

  RAISE NOTICE '===========================================================';
  RAISE NOTICE '  CLEANUP COMPLETE — HYBRID DB MIGRATION FINALIZED';
  RAISE NOTICE '===========================================================';
  RAISE NOTICE '  Remaining listings (FK references only): %', remaining_listings;
  RAISE NOTICE '  Remaining public tables: %', table_count;
  RAISE NOTICE '  Remaining public functions: %', remaining_functions;
  RAISE NOTICE '===========================================================';
  RAISE NOTICE '  Dropped tables:';
  RAISE NOTICE '    listing_sources, listing_photos, listing_hours,';
  RAISE NOTICE '    listing_contacts, listing_categories';
  RAISE NOTICE '  Dropped views:';
  RAISE NOTICE '    listing_full, listing_claim_status,';
  RAISE NOTICE '    listing_classification, company_stats,';
  RAISE NOTICE '    brand_stats, brand_product_stats, category_stats';
  RAISE NOTICE '  Dropped functions: search_listings, search_suggestions,';
  RAISE NOTICE '    search_nearby, browse_category, get_category_counts,';
  RAISE NOTICE '    get_brand_products, get_company_overview,';
  RAISE NOTICE '    get_company_branches, get_listing_breadcrumb,';
  RAISE NOTICE '    get_trending_listings, get_explore_data,';
  RAISE NOTICE '    get_categories_for_type, get_category_tree,';
  RAISE NOTICE '    refresh_materialized_views, and more';
  RAISE NOTICE '===========================================================';
  RAISE NOTICE '  IMPORTANT: New review/fact inserts must now have';
  RAISE NOTICE '  listing_name and listing_slug populated by the app';
  RAISE NOTICE '  before insert (no auto-populate trigger).';
  RAISE NOTICE '===========================================================';
END $$;
