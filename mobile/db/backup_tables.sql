-- =====================================================
-- BACKUP SCRIPT FOR CATEGORY MIGRATION
-- Run manually in Supabase SQL Editor before migration.
-- Backs up affected tables, adds source columns to listings,
-- clears data in FK-safe order, and refreshes materialized views.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: CREATE BACKUP COPIES OF ALL AFFECTED TABLES
-- Uses CREATE TABLE IF NOT EXISTS so re-running is safe.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.categories_backup
  AS SELECT * FROM public.categories;

CREATE TABLE IF NOT EXISTS public.listings_backup
  AS SELECT * FROM public.listings;

CREATE TABLE IF NOT EXISTS public.listing_categories_backup
  AS SELECT * FROM public.listing_categories;

CREATE TABLE IF NOT EXISTS public.listing_sources_backup
  AS SELECT * FROM public.listing_sources;

CREATE TABLE IF NOT EXISTS public.listing_contacts_backup
  AS SELECT * FROM public.listing_contacts;

CREATE TABLE IF NOT EXISTS public.listing_hours_backup
  AS SELECT * FROM public.listing_hours;

CREATE TABLE IF NOT EXISTS public.listing_photos_backup
  AS SELECT * FROM public.listing_photos;

CREATE TABLE IF NOT EXISTS public.listing_claims_backup
  AS SELECT * FROM public.listing_claims;

CREATE TABLE IF NOT EXISTS public.listing_edits_backup
  AS SELECT * FROM public.listing_edits;

CREATE TABLE IF NOT EXISTS public.reviews_backup
  AS SELECT * FROM public.reviews;

CREATE TABLE IF NOT EXISTS public.review_photos_backup
  AS SELECT * FROM public.review_photos;

CREATE TABLE IF NOT EXISTS public.review_votes_backup
  AS SELECT * FROM public.review_votes;

CREATE TABLE IF NOT EXISTS public.review_responses_backup
  AS SELECT * FROM public.review_responses;

CREATE TABLE IF NOT EXISTS public.facts_backup
  AS SELECT * FROM public.facts;

CREATE TABLE IF NOT EXISTS public.fact_checks_backup
  AS SELECT * FROM public.fact_checks;

CREATE TABLE IF NOT EXISTS public.fact_votes_backup
  AS SELECT * FROM public.fact_votes;

CREATE TABLE IF NOT EXISTS public.fact_responses_backup
  AS SELECT * FROM public.fact_responses;

-- =====================================================
-- STEP 2: ADD source AND source_id COLUMNS TO listings
-- Required by the OSM scraper for upsert support.
-- =====================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT;

-- =====================================================
-- STEP 3: CREATE UNIQUE CONSTRAINT ON source_id
-- Enables ON CONFLICT (source_id) DO UPDATE in the scraper via PostgREST.
-- NOTE: Must be a proper UNIQUE constraint, NOT a partial index —
-- PostgREST does not recognize partial unique indexes for upsert.
-- =====================================================

ALTER TABLE public.listings
  ADD CONSTRAINT uq_listings_source_id UNIQUE (source_id);

-- =====================================================
-- STEP 4: CLEAR DATA IN FK-SAFE ORDER
-- listing_categories → listings → categories
-- Deleting from listings cascades to all dependent tables
-- (reviews, facts, listing_contacts, listing_hours,
--  listing_photos, listing_sources, listing_claims,
--  listing_edits, listing_categories, etc.).
-- =====================================================

DELETE FROM public.listing_categories;
DELETE FROM public.listings;
DELETE FROM public.categories;

-- =====================================================
-- STEP 5: REFRESH MATERIALIZED VIEWS
-- They are now empty but must be valid for the app.
-- =====================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_stats;
-- NOTE: brand_product_stats does not exist in the current schema
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_stats;

-- =====================================================
-- STEP 6: VERIFICATION COUNTS
-- =====================================================

DO $$
DECLARE
  v_categories_backup     BIGINT;
  v_listings_backup       BIGINT;
  v_listing_categories_backup BIGINT;
  v_listing_sources_backup    BIGINT;
  v_listing_contacts_backup   BIGINT;
  v_listing_hours_backup      BIGINT;
  v_listing_photos_backup     BIGINT;
  v_listing_claims_backup     BIGINT;
  v_listing_edits_backup      BIGINT;
  v_reviews_backup            BIGINT;
  v_review_photos_backup      BIGINT;
  v_review_votes_backup       BIGINT;
  v_review_responses_backup   BIGINT;
  v_facts_backup              BIGINT;
  v_fact_checks_backup        BIGINT;
  v_fact_votes_backup         BIGINT;
  v_fact_responses_backup     BIGINT;
  v_categories_live           BIGINT;
  v_listings_live             BIGINT;
  v_listing_categories_live   BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_categories_backup             FROM public.categories_backup;
  SELECT COUNT(*) INTO v_listings_backup               FROM public.listings_backup;
  SELECT COUNT(*) INTO v_listing_categories_backup     FROM public.listing_categories_backup;
  SELECT COUNT(*) INTO v_listing_sources_backup        FROM public.listing_sources_backup;
  SELECT COUNT(*) INTO v_listing_contacts_backup       FROM public.listing_contacts_backup;
  SELECT COUNT(*) INTO v_listing_hours_backup          FROM public.listing_hours_backup;
  SELECT COUNT(*) INTO v_listing_photos_backup         FROM public.listing_photos_backup;
  SELECT COUNT(*) INTO v_listing_claims_backup         FROM public.listing_claims_backup;
  SELECT COUNT(*) INTO v_listing_edits_backup          FROM public.listing_edits_backup;
  SELECT COUNT(*) INTO v_reviews_backup                FROM public.reviews_backup;
  SELECT COUNT(*) INTO v_review_photos_backup          FROM public.review_photos_backup;
  SELECT COUNT(*) INTO v_review_votes_backup           FROM public.review_votes_backup;
  SELECT COUNT(*) INTO v_review_responses_backup       FROM public.review_responses_backup;
  SELECT COUNT(*) INTO v_facts_backup                  FROM public.facts_backup;
  SELECT COUNT(*) INTO v_fact_checks_backup            FROM public.fact_checks_backup;
  SELECT COUNT(*) INTO v_fact_votes_backup             FROM public.fact_votes_backup;
  SELECT COUNT(*) INTO v_fact_responses_backup         FROM public.fact_responses_backup;
  SELECT COUNT(*) INTO v_categories_live               FROM public.categories;
  SELECT COUNT(*) INTO v_listings_live                 FROM public.listings;
  SELECT COUNT(*) INTO v_listing_categories_live       FROM public.listing_categories;

  RAISE NOTICE '=== BACKUP VERIFICATION ===';
  RAISE NOTICE 'categories_backup:          % rows', v_categories_backup;
  RAISE NOTICE 'listings_backup:            % rows', v_listings_backup;
  RAISE NOTICE 'listing_categories_backup:  % rows', v_listing_categories_backup;
  RAISE NOTICE 'listing_sources_backup:     % rows', v_listing_sources_backup;
  RAISE NOTICE 'listing_contacts_backup:    % rows', v_listing_contacts_backup;
  RAISE NOTICE 'listing_hours_backup:       % rows', v_listing_hours_backup;
  RAISE NOTICE 'listing_photos_backup:      % rows', v_listing_photos_backup;
  RAISE NOTICE 'listing_claims_backup:      % rows', v_listing_claims_backup;
  RAISE NOTICE 'listing_edits_backup:       % rows', v_listing_edits_backup;
  RAISE NOTICE 'reviews_backup:             % rows', v_reviews_backup;
  RAISE NOTICE 'review_photos_backup:       % rows', v_review_photos_backup;
  RAISE NOTICE 'review_votes_backup:        % rows', v_review_votes_backup;
  RAISE NOTICE 'review_responses_backup:    % rows', v_review_responses_backup;
  RAISE NOTICE 'facts_backup:               % rows', v_facts_backup;
  RAISE NOTICE 'fact_checks_backup:         % rows', v_fact_checks_backup;
  RAISE NOTICE 'fact_votes_backup:          % rows', v_fact_votes_backup;
  RAISE NOTICE 'fact_responses_backup:      % rows', v_fact_responses_backup;
  RAISE NOTICE '=== LIVE TABLES AFTER CLEAR ===';
  RAISE NOTICE 'categories (live):          % rows (expected 0)', v_categories_live;
  RAISE NOTICE 'listings (live):            % rows (expected 0)', v_listings_live;
  RAISE NOTICE 'listing_categories (live):  % rows (expected 0)', v_listing_categories_live;
  RAISE NOTICE '=== DONE ===';
END;
$$;

COMMIT;

-- =====================================================
-- ROLLBACK (commented out — uncomment to restore)
-- Run this ONLY if the migration fails and you need to
-- restore the original data from backup tables.
-- =====================================================

-- BEGIN;
--
-- -- Restore categories first (no FK dependencies)
-- INSERT INTO public.categories SELECT * FROM public.categories_backup
--   ON CONFLICT (id) DO NOTHING;
--
-- -- Restore listings
-- INSERT INTO public.listings SELECT * FROM public.listings_backup
--   ON CONFLICT (id) DO NOTHING;
--
-- -- Restore junction and dependent tables
-- INSERT INTO public.listing_categories SELECT * FROM public.listing_categories_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_sources SELECT * FROM public.listing_sources_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_contacts SELECT * FROM public.listing_contacts_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_hours SELECT * FROM public.listing_hours_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_photos SELECT * FROM public.listing_photos_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_claims SELECT * FROM public.listing_claims_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.listing_edits SELECT * FROM public.listing_edits_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.reviews SELECT * FROM public.reviews_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.review_photos SELECT * FROM public.review_photos_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.review_votes SELECT * FROM public.review_votes_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.review_responses SELECT * FROM public.review_responses_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.facts SELECT * FROM public.facts_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.fact_checks SELECT * FROM public.fact_checks_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.fact_votes SELECT * FROM public.fact_votes_backup
--   ON CONFLICT DO NOTHING;
-- INSERT INTO public.fact_responses SELECT * FROM public.fact_responses_backup
--   ON CONFLICT DO NOTHING;
--
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.category_stats;
--
-- COMMIT;
