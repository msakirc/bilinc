-- =====================================================
-- HYBRID DB MIGRATION — Supabase-side schema changes
-- Run BEFORE migrating catalog data to DynamoDB/Turso
-- =====================================================
--
-- Purpose: Add denormalized listing_name/listing_slug to reviews
-- and facts so user activity screens work without cross-DB joins
-- once listings table is trimmed.
--
-- Safe to run multiple times (uses IF NOT EXISTS, skips backfill
-- for already-populated rows).
-- =====================================================

-- =====================================================
-- 1. ADD LISTING NAME CACHE TO REVIEWS AND FACTS
-- Avoids cross-DB join when showing user activity
-- =====================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS listing_name TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS listing_slug TEXT;

ALTER TABLE facts ADD COLUMN IF NOT EXISTS listing_name TEXT;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS listing_slug TEXT;

-- =====================================================
-- 2. BACKFILL FROM CURRENT LISTINGS DATA
-- (while listings table still has full catalog data)
-- =====================================================

UPDATE reviews r
SET listing_name = l.name, listing_slug = l.slug
FROM listings l
WHERE r.listing_id = l.id
  AND r.listing_name IS NULL;

UPDATE facts f
SET listing_name = l.name, listing_slug = l.slug
FROM listings l
WHERE f.listing_id = l.id
  AND f.listing_name IS NULL;

-- =====================================================
-- 3. TRIGGERS TO AUTO-POPULATE LISTING NAME ON INSERT
-- (while listings table still exists with data)
-- These will be dropped in cleanup-migrated-tables.sql
-- after migration is verified.
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_listing_name_on_review()
RETURNS TRIGGER AS $$
BEGIN
    SELECT name, slug INTO NEW.listing_name, NEW.listing_slug
    FROM listings WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_set_listing_name ON reviews;
CREATE TRIGGER reviews_set_listing_name
    BEFORE INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_listing_name_on_review();

CREATE OR REPLACE FUNCTION public.set_listing_name_on_fact()
RETURNS TRIGGER AS $$
BEGIN
    SELECT name, slug INTO NEW.listing_name, NEW.listing_slug
    FROM listings WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facts_set_listing_name ON facts;
CREATE TRIGGER facts_set_listing_name
    BEFORE INSERT ON facts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_listing_name_on_fact();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  reviews_backfilled BIGINT;
  facts_backfilled BIGINT;
  reviews_missing BIGINT;
  facts_missing BIGINT;
BEGIN
  SELECT COUNT(*) INTO reviews_backfilled
  FROM reviews WHERE listing_name IS NOT NULL;

  SELECT COUNT(*) INTO reviews_missing
  FROM reviews WHERE listing_name IS NULL;

  SELECT COUNT(*) INTO facts_backfilled
  FROM facts WHERE listing_name IS NOT NULL;

  SELECT COUNT(*) INTO facts_missing
  FROM facts WHERE listing_name IS NULL;

  RAISE NOTICE '==================================================';
  RAISE NOTICE '  HYBRID MIGRATION — SCHEMA CHANGES APPLIED';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '  Reviews with listing_name: %', reviews_backfilled;
  RAISE NOTICE '  Reviews missing listing_name: %', reviews_missing;
  RAISE NOTICE '  Facts with listing_name: %', facts_backfilled;
  RAISE NOTICE '  Facts missing listing_name: %', facts_missing;
  RAISE NOTICE '  Triggers installed: reviews_set_listing_name,';
  RAISE NOTICE '                      facts_set_listing_name';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '  Next: Run DynamoDB + Turso migration scripts';
  RAISE NOTICE '==================================================';
END $$;
