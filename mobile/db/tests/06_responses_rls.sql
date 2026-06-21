-- ================================================================
-- 06_responses_rls.sql — review_responses / fact_responses RLS policies
-- ================================================================
-- Policies tested (exact names from more_fixes.sql):
--   review_responses_insert_owner: auth.uid() = user_id
--                                  AND public.user_owns_listing(auth.uid(), listing_id)
--   review_responses_update_own:   auth.uid() = user_id
--   review_responses_delete_own:   auth.uid() = user_id
--   fact_responses_insert_owner:   auth.uid() = user_id
--                                  AND public.user_owns_listing(auth.uid(), listing_id)
--   fact_responses_update_own:     auth.uid() = user_id
--   fact_responses_delete_own:     auth.uid() = user_id
--
-- private.user_owns_listing (from fixes.sql, updated version):
--   Returns TRUE when a verified, non-expired listing_claims row exists for
--   (listing_id, user_id) — direct OR via company-owns-branch hierarchy.
--
-- Table constraints:
--   review_responses.review_id  UNIQUE (one response per review)
--   fact_responses.fact_id      UNIQUE (one response per fact)
--
-- FINDING: There is NO "admin override" INSERT policy on review_responses /
-- fact_responses — admin can only insert via review_responses_all_admin /
-- fact_responses_all_admin FOR ALL (which includes INSERT).
--
-- All work wrapped in BEGIN/ROLLBACK.
-- ================================================================
BEGIN;

SELECT plan(10);

-- ----------------------------------------------------------------
-- Seed: consumer + business_owner users + listing + review + fact
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0006-0000-0000-000000000001',
   'resp_consumer@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0006-0000-0000-000000000002',
   'resp_owner@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0006-0000-0000-000000000003',
   'resp_other@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0006-0000-0000-000000000001', 'resp_consumer', 'consumer',       0, 'novice', true),
  ('00000000-0006-0000-0000-000000000002', 'resp_owner',    'business_owner', 0, 'novice', true),
  ('00000000-0006-0000-0000-000000000003', 'resp_other',    'business_owner', 0, 'novice', true);

INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0006-0000-0000-0000000000aa', 'resp-biz', 'Response Test Biz', 'business', '34', 'active');

-- Verified claim: resp_owner owns resp-biz
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status)
VALUES ('00000000-0006-0000-0000-0000000000c1',
        '00000000-0006-0000-0000-0000000000aa',
        '00000000-0006-0000-0000-000000000002',
        'owner', 'verified');

-- A review and a fact (both seeded as postgres role to bypass RLS)
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
VALUES ('00000000-0006-0000-0000-0000000000b1',
        '00000000-0006-0000-0000-0000000000aa',
        '00000000-0006-0000-0000-000000000001',
        3, 'Consumer review', 'active');

INSERT INTO public.facts (id, listing_id, user_id, statement, category, truth_guarantee)
VALUES ('00000000-0006-0000-0000-0000000000f1',
        '00000000-0006-0000-0000-0000000000aa',
        '00000000-0006-0000-0000-000000000001',
        'Some verifiable claim', 'safety', true);

-- ----------------------------------------------------------------
-- TEST 1: Consumer (non-owner) cannot insert a review response
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.review_responses (review_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000b1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000001',
            'Consumer trying to respond')$$,
  NULL,
  'review_responses_insert_owner: consumer (non-owner) must be blocked'
);

-- ----------------------------------------------------------------
-- TEST 2: Verified listing owner CAN insert a review response
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.review_responses (id, review_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000r1',
            '00000000-0006-0000-0000-0000000000b1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000002',
            'Thank you for your feedback!')$$,
  'review_responses_insert_owner: verified listing owner can insert review response'
);

-- ----------------------------------------------------------------
-- TEST 3: One response per review (UNIQUE on review_id)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.review_responses (review_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000b1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000002',
            'Duplicate response attempt')$$,
  '23505',
  'review_responses UNIQUE(review_id): second response on same review must fail'
);

-- ----------------------------------------------------------------
-- TEST 4: Other business owner (not the listing owner) cannot respond
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000003', true);

-- Need a different review to avoid unique constraint confusion
RESET ROLE;
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
VALUES ('00000000-0006-0000-0000-0000000000b2',
        '00000000-0006-0000-0000-0000000000aa',
        '00000000-0006-0000-0000-000000000001',
        2, 'Second consumer review', 'active');
-- Remove the duplicate user_listing for the same user — need a different listing
-- Actually reviews have UNIQUE(user_id, listing_id), so different user needed.
-- Let's use the fact_responses path instead for "other owner" test.

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000003', true);

SELECT throws_ok(
  $$INSERT INTO public.fact_responses (fact_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000f1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000003',
            'Other owner trying to respond to fact')$$,
  NULL,
  'fact_responses_insert_owner: non-listing-owner business_owner must be blocked'
);

-- ----------------------------------------------------------------
-- TEST 5: Verified listing owner CAN insert a fact response
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.fact_responses (id, fact_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000fr1',
            '00000000-0006-0000-0000-0000000000f1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000002',
            'We take this fact seriously.')$$,
  'fact_responses_insert_owner: verified listing owner can insert fact response'
);

-- ----------------------------------------------------------------
-- TEST 6: One response per fact (UNIQUE on fact_id)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.fact_responses (fact_id, listing_id, user_id, content)
    VALUES ('00000000-0006-0000-0000-0000000000f1',
            '00000000-0006-0000-0000-0000000000aa',
            '00000000-0006-0000-0000-000000000002',
            'Duplicate fact response attempt')$$,
  '23505',
  'fact_responses UNIQUE(fact_id): second response on same fact must fail'
);

-- ----------------------------------------------------------------
-- TEST 7: Owner can update their own review response
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$UPDATE public.review_responses
    SET content = 'Updated: thank you!', updated_at = NOW()
    WHERE id = '00000000-0006-0000-0000-0000000000r1'$$,
  'review_responses_update_own: owner can update their own response'
);

-- ----------------------------------------------------------------
-- TEST 8: Other user cannot update owner's review response (0 rows)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000001', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    UPDATE public.review_responses SET content = 'Hack'
    WHERE id = '00000000-0006-0000-0000-0000000000r1'
    RETURNING id
  ) t),
  0,
  'review_responses_update_own: non-owner UPDATE on owner response must affect 0 rows'
);

-- ----------------------------------------------------------------
-- TEST 9: Other user cannot delete owner's review response (0 rows)
-- ----------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.review_responses
    WHERE id = '00000000-0006-0000-0000-0000000000r1'
    RETURNING id
  ) t),
  0,
  'review_responses_delete_own: non-owner DELETE on owner response must affect 0 rows'
);

-- ----------------------------------------------------------------
-- TEST 10: Owner can delete their own review response
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0006-0000-0000-000000000002', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.review_responses
    WHERE id = '00000000-0006-0000-0000-0000000000r1'
    RETURNING id
  ) t),
  1,
  'review_responses_delete_own: owner can delete their own response'
);

SELECT * FROM finish();
ROLLBACK;
