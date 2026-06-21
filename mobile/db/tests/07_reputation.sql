-- ================================================================
-- 07_reputation.sql — Reputation trigger: private.update_user_reputation
-- ================================================================
-- Trigger source (from tables.sql, private.update_user_reputation):
--   Fires AFTER INSERT OR UPDATE OR DELETE on:
--     reviews, facts, review_votes, fact_votes
--
-- Reputation formula (EXACT from tables.sql):
--   score = (
--     -- Helpful review points: SUM(GREATEST(helpful_count, 0)) * 2
--     --   where helpful_count = (helpful votes - not_helpful votes)
--     COALESCE( SUM(GREATEST(helpful_count,0)) * 2 FROM active reviews, 0)
--     +
--     -- Verified fact points: COUNT(*) * 5 FROM verified facts
--     COALESCE( COUNT(*) * 5 FROM verified facts, 0)
--     +
--     -- Activity bonus (capped at 50):
--     LEAST(
--       COUNT(active reviews) + COUNT(all facts), 50
--     )
--     -
--     -- Disputed fact penalty: COUNT(*) * 3 FROM disputed facts
--     COALESCE( COUNT(*) * 3 FROM disputed facts, 0)
--   )
--   score = GREATEST(score, 0)  -- floor at 0
--
-- Credibility tiers (EXACT from tables.sql update_user_reputation):
--   score >= 500 → 'expert'
--   score >= 200 → 'trusted'
--   score >=  50 → 'contributor'
--   else         → 'novice'
--
-- Tests verify the trigger fires and produces the correct numeric output.
-- All work wrapped in BEGIN/ROLLBACK.
-- ================================================================
BEGIN;

SELECT plan(12);

-- ----------------------------------------------------------------
-- Seed: one user + one listing
-- Using postgres role throughout (no RLS gate needed for trigger tests)
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES ('00000000-0007-0000-0000-000000000001',
        'repuser@test.internal', NOW(), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES ('00000000-0007-0000-0000-000000000001', 'rep_user', 'consumer', 0, 'novice', true);

INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0007-0000-0000-0000000000aa', 'rep-biz', 'Reputation Test Biz', 'business', '34', 'active');

-- ----------------------------------------------------------------
-- TEST 1: baseline — rep=0, level='novice' before any activity
-- ----------------------------------------------------------------
SELECT is(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  0,
  'baseline: reputation_score must start at 0'
);

SELECT is(
  (SELECT credibility_level FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  'novice',
  'baseline: credibility_level must start as novice'
);

-- ----------------------------------------------------------------
-- Insert one active review (helpful_count=0 initially).
-- Trigger fires: activity bonus +1 (from 1 review).
-- No helpful votes yet, so formula: 0 (helpful pts) + 0 (fact pts) + 1 (activity) - 0 = 1
-- ----------------------------------------------------------------
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status, helpful_count)
VALUES ('00000000-0007-0000-0000-0000000000b1',
        '00000000-0007-0000-0000-0000000000aa',
        '00000000-0007-0000-0000-000000000001',
        4, 'First review', 'active', 0);

-- ----------------------------------------------------------------
-- TEST 3: After 1 review with helpful_count=0 → score = 1 (activity bonus only)
-- Formula: helpful_pts=0, fact_pts=0, activity=min(1+0,50)=1, disputed=0 → score=1
-- ----------------------------------------------------------------
SELECT is(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  1,
  'after 1 active review (no votes): score = 1 (activity bonus)'
);

-- ----------------------------------------------------------------
-- Simulate 3 "helpful" votes for the review (update helpful_count directly,
-- then trigger fires via UPDATE on reviews table).
-- The trigger reads helpful_count from the reviews table.
-- After update: helpful_pts = GREATEST(3,0)*2 = 6, activity = 1 → score = 7
-- ----------------------------------------------------------------
UPDATE public.reviews
SET helpful_count = 3
WHERE id = '00000000-0007-0000-0000-0000000000b1';

-- ----------------------------------------------------------------
-- TEST 4: After 3 helpful votes on review → score = 6(helpful) + 1(activity) = 7
-- ----------------------------------------------------------------
SELECT is(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  7,
  'after helpful_count=3: score = 3*2 + 1(activity) = 7'
);

-- ----------------------------------------------------------------
-- Insert a VERIFIED fact.
-- fact_pts = 1 * 5 = 5. activity = min(1 review + 1 fact, 50) = 2
-- helpful_pts = 6 (still from review with helpful_count=3)
-- score = 6 + 5 + 2 = 13
-- ----------------------------------------------------------------
INSERT INTO public.facts (id, listing_id, user_id, statement, category, verification_status, truth_guarantee)
VALUES ('00000000-0007-0000-0000-0000000000f1',
        '00000000-0007-0000-0000-0000000000aa',
        '00000000-0007-0000-0000-000000000001',
        'Verified claim', 'safety', 'verified', true);

-- ----------------------------------------------------------------
-- TEST 5: After 1 verified fact → score = 6(helpful) + 5(verified fact) + 2(activity) = 13
-- ----------------------------------------------------------------
SELECT is(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  13,
  'after 1 verified fact: score = 6(helpful) + 5(fact) + 2(activity) = 13'
);

-- ----------------------------------------------------------------
-- TEST 6: Level is still 'novice' at score=13 (threshold is >=50)
-- ----------------------------------------------------------------
SELECT is(
  (SELECT credibility_level FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  'novice',
  'credibility at 13: must still be novice (threshold >=50 for contributor)'
);

-- ----------------------------------------------------------------
-- Add enough verified facts to push score to >=50 → 'contributor'
-- Need: helpful_pts(6) + fact_pts(N*5) + activity(min(1+N,50)) >= 50
-- At N=9 facts total: fact_pts=45, activity=min(10,50)=10, helpful=6 → score=61
-- That means 8 more verified facts beyond the first.
-- ----------------------------------------------------------------
INSERT INTO public.facts (listing_id, user_id, statement, category, verification_status, truth_guarantee)
SELECT
  '00000000-0007-0000-0000-0000000000aa',
  '00000000-0007-0000-0000-000000000001',
  'Bulk verified fact ' || g,
  'health',
  'verified',
  true
FROM generate_series(1, 8) g;

-- With 9 verified facts + 1 review:
-- fact_pts = 9 * 5 = 45
-- helpful_pts = 6
-- activity = min(1+9, 50) = 10
-- disputed = 0
-- score = 45 + 6 + 10 = 61 → 'contributor' (>=50)

-- ----------------------------------------------------------------
-- TEST 7: Score >= 50 → credibility_level = 'contributor'
-- ----------------------------------------------------------------
SELECT is(
  (SELECT credibility_level FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  'contributor',
  'score >= 50: credibility_level must be contributor'
);

-- ----------------------------------------------------------------
-- TEST 8: Disputed fact subtracts 3 from score
-- Before: 61. One disputed fact: score = 61 - 3 = 58 (still >=50 → contributor)
-- Also activity cap: total facts now 10, reviews 1, activity = min(11, 50) = 11
-- New score: 45(verified, 9 facts) + 6(helpful) + 11(activity) - 3(disputed) = 59
-- ----------------------------------------------------------------
INSERT INTO public.facts (listing_id, user_id, statement, category, verification_status, truth_guarantee)
VALUES ('00000000-0007-0000-0000-0000000000aa',
        '00000000-0007-0000-0000-000000000001',
        'Disputed claim', 'legal', 'disputed', true);

SELECT is(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  59,
  'after 1 disputed fact: score = 45(9 verified*5) + 6(helpful) + 11(activity) - 3(disputed) = 59'
);

-- ----------------------------------------------------------------
-- Push score to >=200 for 'trusted' tier
-- Need ~141 more points. Easiest: add 28 more verified facts.
-- 37 verified facts * 5 = 185, plus helpful=6, activity=min(1+38,50)=39, disputed=3
-- score = 185 + 6 + 39 - 3 = 227 → 'trusted'
-- ----------------------------------------------------------------
INSERT INTO public.facts (listing_id, user_id, statement, category, verification_status, truth_guarantee)
SELECT
  '00000000-0007-0000-0000-0000000000aa',
  '00000000-0007-0000-0000-000000000001',
  'Extra verified fact ' || g,
  'quality',
  'verified',
  true
FROM generate_series(1, 28) g;

-- 37 verified + 1 disputed = 38 facts total + 1 review = 39 items
-- fact_pts = 37*5 = 185; activity = min(38+1, 50) = 39; helpful=6; disputed=1*3=3
-- score = 185 + 6 + 39 - 3 = 227

-- ----------------------------------------------------------------
-- TEST 9: Score >= 200 → credibility_level = 'trusted'
-- ----------------------------------------------------------------
SELECT is(
  (SELECT credibility_level FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  'trusted',
  'score >= 200: credibility_level must be trusted'
);

-- ----------------------------------------------------------------
-- Push score to >=500 for 'expert' tier
-- Need ~273 more. Add 60 more verified facts.
-- 97 verified * 5 = 485; activity = min(97+1+1, 50)=50; helpful=6; disputed=3
-- score = 485 + 6 + 50 - 3 = 538 → 'expert'
-- ----------------------------------------------------------------
INSERT INTO public.facts (listing_id, user_id, statement, category, verification_status, truth_guarantee)
SELECT
  '00000000-0007-0000-0000-0000000000aa',
  '00000000-0007-0000-0000-000000000001',
  'Expert fact ' || g,
  'environmental',
  'verified',
  true
FROM generate_series(1, 60) g;

-- ----------------------------------------------------------------
-- TEST 10: Score >= 500 → credibility_level = 'expert'
-- ----------------------------------------------------------------
SELECT is(
  (SELECT credibility_level FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001'),
  'expert',
  'score >= 500: credibility_level must be expert'
);

-- ----------------------------------------------------------------
-- TEST 11: Deleting a verified fact reduces score (trigger fires on DELETE)
-- Delete 60 facts just added. Dropping back below 500 but still >=200.
-- ----------------------------------------------------------------
DELETE FROM public.facts
WHERE user_id = '00000000-0007-0000-0000-000000000001'
  AND statement LIKE 'Expert fact %';

SELECT ok(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001') < 500,
  'after deleting 60 expert facts: score must drop below 500'
);

SELECT ok(
  (SELECT reputation_score FROM public.users WHERE id = '00000000-0007-0000-0000-000000000001') >= 200,
  'after deleting 60 expert facts: score must still be >= 200 (trusted tier)'
);

SELECT * FROM finish();
ROLLBACK;
