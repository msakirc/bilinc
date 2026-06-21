-- =====================================================
-- FIX: Fact category CHECK constraint
-- =====================================================
-- The app (app/business/[id]/fact.tsx) lets users report facts in 8
-- categories, including 'abuse' (Kötü Muamele) and 'işçi hakları' ('labor').
-- The original CHECK constraint in tables.sql only allowed:
--   safety, ownership, health, quality, legal, environmental, other
-- so any fact submitted with category 'abuse' or 'labor' was rejected by the DB.
--
-- This migration drops and recreates the CHECK constraint to add the two
-- missing values. It is idempotent and safe to run on the live database.
--
-- Run order: after tables.sql (and any time the constraint needs to be
-- brought back in sync with the app's fact categories).
-- =====================================================

-- The constraint is auto-named by Postgres when declared inline as
-- `category TEXT NOT NULL CHECK (...)`. The generated name is
-- "facts_category_check". Drop it if present, then recreate with the full set.
ALTER TABLE public.facts
  DROP CONSTRAINT IF EXISTS facts_category_check;

ALTER TABLE public.facts
  ADD CONSTRAINT facts_category_check
  CHECK (category IN (
    'safety',
    'ownership',
    'health',
    'quality',
    'legal',
    'environmental',
    'abuse',
    'labor',
    'other'
  ));
