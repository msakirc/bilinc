-- ================================================================
-- 04_reviews_rls.sql — Reviews RLS policies
-- ================================================================
-- Policies tested (exact names from more_fixes.sql, policies.sql):
--   reviews_insert_auth  : auth.uid() IS NOT NULL AND auth.uid() = user_id
--   reviews_select_active: status = 'active'
--   reviews_update_own   : auth.uid() = user_id (USING + WITH CHECK)
--   reviews_delete_own   : auth.uid() = user_id
--
-- Table constraints:
--   UNIQUE INDEX idx_reviews_user_listing ON reviews(user_id, listing_id)
--   rating SMALLINT CHECK (rating BETWEEN 1 AND 5)
--
-- All work wrapped in BEGIN/ROLLBACK.
-- ================================================================
BEGIN;

SELECT plan(10);

-- ----------------------------------------------------------------
-- Seed: two users + one listing
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0004-0000-0000-000000000001',
   'reviewer_a@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0004-0000-0000-000000000002',
   'reviewer_b@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0004-0000-0000-000000000001', 'reviewer_a', 'consumer', 0, 'novice', true),
  ('00000000-0004-0000-0000-000000000002', 'reviewer_b', 'consumer', 0, 'novice', true);

INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0004-0000-0000-0000000000aa', 'review-biz', 'Review Test Biz', 'business', '34', 'active');

-- ----------------------------------------------------------------
-- TEST 1: Authenticated user can insert a review (reviews_insert_auth)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0004-0000-0000-000000000001', true);

SELECT lives_ok(
  $$INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
    VALUES ('00000000-0004-0000-0000-0000000000b1',
            '00000000-0004-0000-0000-0000000000aa',
            '00000000-0004-0000-0000-000000000001',
            4, 'Good place', 'active')$$,
  'reviews_insert_auth: authenticated user A can insert their own review'
);

-- ----------------------------------------------------------------
-- TEST 2: user_id spoofing blocked — user A cannot insert as user B
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
    VALUES ('00000000-0004-0000-0000-0000000000b2',
            '00000000-0004-0000-0000-0000000000aa',
            '00000000-0004-0000-0000-000000000002',
            3, 'Spoof attempt', 'active')$$,
  NULL,
  'reviews_insert_auth: user_id spoofing must be blocked by WITH CHECK'
);

-- ----------------------------------------------------------------
-- TEST 3: One review per user per listing (unique index)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
    VALUES ('00000000-0004-0000-0000-0000000000b3',
            '00000000-0004-0000-0000-0000000000aa',
            '00000000-0004-0000-0000-000000000001',
            5, 'Second review same listing', 'active')$$,
  '23505',
  'unique index: second review by same user on same listing must fail'
);

-- ----------------------------------------------------------------
-- TEST 4: Rating 0 blocked by CHECK constraint
-- (Insert a fresh review for a non-existing listing to isolate the CHECK)
-- We'll insert a temporary listing for this test
-- ----------------------------------------------------------------
RESET ROLE;
INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0004-0000-0000-0000000000ab', 'review-biz-2', 'Review Test Biz 2', 'business', '06', 'active');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0004-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.reviews (listing_id, user_id, rating, content, status)
    VALUES ('00000000-0004-0000-0000-0000000000ab',
            '00000000-0004-0000-0000-000000000001',
            0, 'Zero rating test', 'active')$$,
  '23514',
  'rating CHECK: rating=0 must fail check_violation'
);

-- ----------------------------------------------------------------
-- TEST 5: Rating 6 blocked by CHECK constraint
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.reviews (listing_id, user_id, rating, content, status)
    VALUES ('00000000-0004-0000-0000-0000000000ab',
            '00000000-0004-0000-0000-000000000001',
            6, 'Six rating test', 'active')$$,
  '23514',
  'rating CHECK: rating=6 must fail check_violation'
);

-- ----------------------------------------------------------------
-- TEST 6: User A can update their own review (reviews_update_own)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$UPDATE public.reviews
    SET content = 'Updated content', updated_at = NOW()
    WHERE id = '00000000-0004-0000-0000-0000000000b1'$$,
  'reviews_update_own: user A can update their own review'
);

-- ----------------------------------------------------------------
-- Seed user B's review (bypass RLS via RESET ROLE)
-- ----------------------------------------------------------------
RESET ROLE;
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
VALUES ('00000000-0004-0000-0000-0000000000b4',
        '00000000-0004-0000-0000-0000000000aa',
        '00000000-0004-0000-0000-000000000002',
        3, 'User B review', 'active');

-- ----------------------------------------------------------------
-- TEST 7: User A cannot UPDATE user B's review (reviews_update_own)
-- In PostgreSQL RLS, UPDATE on non-matching rows silently affects 0 rows
-- (no error) — the policy USING clause filters matching rows.
-- We assert 0 rows updated.
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0004-0000-0000-000000000001', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    UPDATE public.reviews SET content = 'Hack attempt'
    WHERE id = '00000000-0004-0000-0000-0000000000b4'
    RETURNING id
  ) t),
  0,
  'reviews_update_own: user A UPDATE on user B review must affect 0 rows'
);

-- ----------------------------------------------------------------
-- TEST 8: User A cannot DELETE user B's review (reviews_delete_own)
-- ----------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.reviews
    WHERE id = '00000000-0004-0000-0000-0000000000b4'
    RETURNING id
  ) t),
  0,
  'reviews_delete_own: user A DELETE on user B review must affect 0 rows'
);

-- ----------------------------------------------------------------
-- Seed a hidden review (status='hidden') for select test
-- ----------------------------------------------------------------
RESET ROLE;
INSERT INTO public.reviews (id, listing_id, user_id, rating, content, status)
VALUES ('00000000-0004-0000-0000-0000000000b5',
        '00000000-0004-0000-0000-0000000000ab',
        '00000000-0004-0000-0000-000000000002',
        2, 'Hidden review', 'hidden');

-- ----------------------------------------------------------------
-- TEST 9: reviews_select_active hides non-active reviews from other users
-- User A cannot see user B's hidden review
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0004-0000-0000-000000000001', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.reviews
   WHERE id = '00000000-0004-0000-0000-0000000000b5'),
  0,
  'reviews_select_active: hidden review invisible to other authenticated user'
);

-- ----------------------------------------------------------------
-- TEST 10: User A can delete their own review (reviews_delete_own)
-- ----------------------------------------------------------------
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.reviews
    WHERE id = '00000000-0004-0000-0000-0000000000b1'
    RETURNING id
  ) t),
  1,
  'reviews_delete_own: user A can delete their own review'
);

SELECT * FROM finish();
ROLLBACK;
