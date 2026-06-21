-- ================================================================
-- 02_vote_dedup.sql — Vote uniqueness / dedup constraints
-- ================================================================
-- Tables / constraints tested:
--   review_votes  PRIMARY KEY (review_id, user_id)
--   fact_votes    PRIMARY KEY (fact_id, user_id)
--   fact_checks   UNIQUE(fact_id, user_id)
--
-- Policies tested (from more_fixes.sql final definitions):
--   review_votes_insert_auth: auth.uid() IS NOT NULL AND auth.uid() = user_id
--   fact_votes_insert_auth:   auth.uid() IS NOT NULL AND auth.uid() = user_id
--   fact_checks_insert_auth:  auth.uid() IS NOT NULL AND auth.uid() = user_id
--
-- All work wrapped in BEGIN/ROLLBACK.
-- ================================================================
BEGIN;

SELECT plan(9);

-- ----------------------------------------------------------------
-- Seed
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0002-0000-0000-000000000001',
   'voter_a@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0002-0000-0000-000000000002',
   'voter_b@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0002-0000-0000-000000000001', 'voter_a', 'consumer', 0, 'novice', true),
  ('00000000-0002-0000-0000-000000000002', 'voter_b', 'consumer', 0, 'novice', true);

INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0002-0000-0000-0000000000aa', 'vote-biz', 'Vote Test Biz', 'business', '34', 'active');

-- Insert a review as voter_a (bypass RLS via postgres role for seeding)
RESET ROLE;
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
VALUES ('00000000-0002-0000-0000-0000000000bb',
        '00000000-0002-0000-0000-0000000000aa',
        '00000000-0002-0000-0000-000000000001',
        4, 'Great place', 'active');

-- Insert a fact as voter_a (bypass rep gate via postgres role for seeding)
INSERT INTO public.facts (id, listing_id, user_id, statement, category, truth_guarantee)
VALUES ('00000000-0002-0000-0000-0000000000cc',
        '00000000-0002-0000-0000-0000000000aa',
        '00000000-0002-0000-0000-000000000001',
        'Seed fact for vote tests', 'safety', true);

-- ----------------------------------------------------------------
-- Switch to voter_b for vote tests
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0002-0000-0000-000000000002', true);

-- ----------------------------------------------------------------
-- TEST 1: First review_vote insert succeeds
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.review_votes (review_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000bb',
            '00000000-0002-0000-0000-000000000002',
            'helpful')$$,
  'first review_vote insert by voter_b must succeed'
);

-- ----------------------------------------------------------------
-- TEST 2: Duplicate review_vote (same review_id, user_id) → PK violation
-- SQLSTATE 23505 = unique_violation
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.review_votes (review_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000bb',
            '00000000-0002-0000-0000-000000000002',
            'helpful')$$,
  '23505',
  'second review_vote by same user on same review must fail with unique_violation'
);

-- ----------------------------------------------------------------
-- TEST 3: Switching vote type still triggers PK violation (not an upsert)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.review_votes (review_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000bb',
            '00000000-0002-0000-0000-000000000002',
            'not_helpful')$$,
  '23505',
  'duplicate review_vote with different vote_type also triggers unique_violation'
);

-- ----------------------------------------------------------------
-- TEST 4: First fact_vote insert succeeds
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.fact_votes (fact_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000cc',
            '00000000-0002-0000-0000-000000000002',
            'helpful')$$,
  'first fact_vote insert by voter_b must succeed'
);

-- ----------------------------------------------------------------
-- TEST 5: Duplicate fact_vote (same fact_id, user_id) → PK violation
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.fact_votes (fact_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000cc',
            '00000000-0002-0000-0000-000000000002',
            'helpful')$$,
  '23505',
  'second fact_vote by same user on same fact must fail with unique_violation'
);

-- ----------------------------------------------------------------
-- TEST 6: fact_check insert succeeds (first)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.fact_checks (fact_id, user_id, vote)
    VALUES ('00000000-0002-0000-0000-0000000000cc',
            '00000000-0002-0000-0000-000000000002',
            'verify')$$,
  'first fact_check insert by voter_b must succeed'
);

-- ----------------------------------------------------------------
-- TEST 7: Duplicate fact_check (same fact_id, user_id) → unique violation
-- Constraint: UNIQUE(fact_id, user_id) on fact_checks table
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.fact_checks (fact_id, user_id, vote)
    VALUES ('00000000-0002-0000-0000-0000000000cc',
            '00000000-0002-0000-0000-000000000002',
            'dispute')$$,
  '23505',
  'second fact_check by same user on same fact must fail with unique_violation'
);

-- ----------------------------------------------------------------
-- TEST 8: review_votes user_id spoofing blocked by RLS
-- voter_b (authenticated) cannot insert a vote claiming voter_a's user_id
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.review_votes (review_id, user_id, vote_type)
    VALUES ('00000000-0002-0000-0000-0000000000bb',
            '00000000-0002-0000-0000-000000000001',
            'helpful')$$,
  NULL,
  'review_votes_insert_auth: cannot insert vote as another user_id'
);

-- ----------------------------------------------------------------
-- TEST 9: fact_check vote value CHECK — only verify/dispute/needs_evidence
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.fact_checks (fact_id, user_id, vote)
    VALUES ('00000000-0002-0000-0000-0000000000cc',
            '00000000-0002-0000-0000-000000000002',
            'upvote')$$,
  '23514',
  'fact_checks vote CHECK: invalid vote value must trigger check_violation'
);

SELECT * FROM finish();
ROLLBACK;
