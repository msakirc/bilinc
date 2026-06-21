-- ================================================================
-- 05_claims_rls.sql — listing_claims RLS policies
-- ================================================================
-- Policies tested (insert policy updated by claim_submit_flow.sql):
--   listing_claims_insert_self: auth.uid() = user_id AND status = 'pending'
--     (any authenticated user may file a PENDING claim for themselves; they
--      cannot self-grant 'verified' — verification is what makes them an owner)
--   listing_claims_delete_own_pending: auth.uid() = user_id AND status = 'pending'
--
-- Table constraints (from tables.sql):
--   UNIQUE INDEX idx_claims_pending_user ON listing_claims(listing_id, user_id)
--     WHERE status = 'pending'         → one pending claim per user per listing
--   UNIQUE INDEX idx_claims_verified_owner ON listing_claims(listing_id)
--     WHERE status = 'verified' AND role = 'owner'
--                                      → one verified owner per listing
--   role CHECK (role IN ('owner','manager','employee'))
--   status CHECK (status IN ('pending','verified','rejected','revoked','expired'))
--   verification_method CHECK (verification_method IN ('document','phone','email','domain','admin'))
--
-- All work wrapped in BEGIN/ROLLBACK.
-- ================================================================
BEGIN;

SELECT * FROM no_plan();

-- ----------------------------------------------------------------
-- Seed: consumer + business_owner users + two listings
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0005-0000-0000-000000000001',
   'consumer_c@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0005-0000-0000-000000000002',
   'biz_owner@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'),
  ('00000000-0005-0000-0000-000000000003',
   'biz_owner2@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0005-0000-0000-000000000001', 'consumer_c',  'consumer',       0, 'novice', true),
  ('00000000-0005-0000-0000-000000000002', 'biz_owner_1', 'business_owner', 0, 'novice', true),
  ('00000000-0005-0000-0000-000000000003', 'biz_owner_2', 'business_owner', 0, 'novice', true);

INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES
  ('00000000-0005-0000-0000-0000000000aa', 'claim-biz-1', 'Claim Test Biz 1', 'business', '34', 'active'),
  ('00000000-0005-0000-0000-0000000000ab', 'claim-biz-2', 'Claim Test Biz 2', 'business', '06', 'active');

-- ----------------------------------------------------------------
-- TEST 1: Consumer CAN now file a PENDING claim for themselves
-- (claim_submit_flow.sql: self-service onboarding — verification is what
--  later promotes them to business_owner)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000001', true);

SELECT lives_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000aa',
            '00000000-0005-0000-0000-000000000001',
            'owner', 'pending')$$,
  'listing_claims_insert_self: consumer can file a pending claim for themselves'
);

-- ----------------------------------------------------------------
-- TEST 2: business_owner CAN insert a claim
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.listing_claims (id, listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000c1',
            '00000000-0005-0000-0000-0000000000aa',
            '00000000-0005-0000-0000-000000000002',
            'owner', 'pending')$$,
  'listing_claims_insert_business: business_owner can insert a claim'
);

-- ----------------------------------------------------------------
-- TEST 3: One pending claim per user per listing (partial unique index)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000aa',
            '00000000-0005-0000-0000-000000000002',
            'owner', 'pending')$$,
  '23505',
  'idx_claims_pending_user: duplicate pending claim by same user on same listing must fail'
);

-- ----------------------------------------------------------------
-- TEST 4: user_id spoofing in claim insert is blocked
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000ab',
            '00000000-0005-0000-0000-000000000003',
            'owner', 'pending')$$,
  NULL,
  'listing_claims_insert_business: WITH CHECK auth.uid()=user_id blocks user_id spoofing'
);

-- ----------------------------------------------------------------
-- TEST 5: One verified owner per listing (partial unique index)
-- Seed two verified-owner rows via postgres role; second must fail.
-- ----------------------------------------------------------------
RESET ROLE;
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status)
VALUES ('00000000-0005-0000-0000-0000000000c2',
        '00000000-0005-0000-0000-0000000000ab',
        '00000000-0005-0000-0000-000000000002',
        'owner', 'verified');

SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000ab',
            '00000000-0005-0000-0000-000000000003',
            'owner', 'verified')$$,
  '23505',
  'idx_claims_verified_owner: second verified owner on same listing must fail'
);

-- ----------------------------------------------------------------
-- TEST 6: Business_owner can delete their own pending claim
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000002', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.listing_claims
    WHERE id = '00000000-0005-0000-0000-0000000000c1'
    RETURNING id
  ) t),
  1,
  'listing_claims_delete_own_pending: business_owner can delete their own pending claim'
);

-- ----------------------------------------------------------------
-- TEST 7: Business_owner cannot delete another owner's claim
-- ----------------------------------------------------------------
-- c2 is owned by biz_owner_2 and verified (not pending), so
-- the delete_own_pending policy (status='pending' AND auth.uid()=user_id)
-- would also block it on two counts.
-- Seed a pending claim for owner_3 on listing aa to test auth.uid()=user_id
RESET ROLE;
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status)
VALUES ('00000000-0005-0000-0000-0000000000c3',
        '00000000-0005-0000-0000-0000000000aa',
        '00000000-0005-0000-0000-000000000003',
        'owner', 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000002', true);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM (
    DELETE FROM public.listing_claims
    WHERE id = '00000000-0005-0000-0000-0000000000c3'
    RETURNING id
  ) t),
  0,
  'listing_claims_delete_own_pending: cannot delete another owner pending claim'
);

-- ----------------------------------------------------------------
-- TEST 8: verification_method CHECK — invalid value rejected
-- ----------------------------------------------------------------
RESET ROLE;
SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status, verification_method)
    VALUES ('00000000-0005-0000-0000-0000000000aa',
            '00000000-0005-0000-0000-000000000003',
            'owner', 'pending', 'carrier_pigeon')$$,
  '23514',
  'verification_method CHECK: invalid value must be rejected'
);

-- ----------------------------------------------------------------
-- TEST 8b: verification_method CHECK — video is now accepted
-- ----------------------------------------------------------------
-- Uses consumer_c (uid 001) on listing ab — no pending claim exists for that
-- user+listing combo, so the partial unique index (idx_claims_pending_user) is
-- not triggered and the insert exercises ONLY the verification_method CHECK.
SELECT lives_ok(
  $$ INSERT INTO public.listing_claims (listing_id, user_id, role, status, verification_method)
     VALUES ('00000000-0005-0000-0000-0000000000ab',
             '00000000-0005-0000-0000-000000000001', 'owner', 'pending', 'video') $$,
  'verification_method = video is accepted');

-- ----------------------------------------------------------------
-- TEST 9: role CHECK — invalid value rejected
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000aa',
            '00000000-0005-0000-0000-000000000003',
            'ceo', 'pending')$$,
  '23514',
  'role CHECK: invalid role value must be rejected'
);

-- ----------------------------------------------------------------
-- TEST 10: A user CANNOT self-grant 'verified' (insert policy forces pending)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0005-0000-0000-0000000000ab',
            '00000000-0005-0000-0000-000000000001',
            'manager', 'verified')$$,
  NULL,
  'listing_claims_insert_self: WITH CHECK status=pending blocks self-granting verified'
);

-- ----------------------------------------------------------------
-- TEST 11: Non-owner cannot insert a review_response
-- (RLS: auth.uid() = user_id AND listing_id must belong to a
--  verified claim owned by auth.uid())
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000001', true);

-- consumer_c has no verified claim on listing aa; insert must be denied
SELECT throws_ok(
  $$INSERT INTO public.review_responses (review_id, listing_id, content, user_id)
    VALUES ('00000000-0000-0000-0000-000000000099',
            '00000000-0005-0000-0000-0000000000aa',
            'owner reply attempt by non-owner',
            '00000000-0005-0000-0000-000000000001')$$,
  NULL,
  'review_responses: non-owner insert is blocked by RLS'
);

-- ----------------------------------------------------------------
-- TEST 12: Verified owner CAN insert a review_response
-- (biz_owner_2 holds the verified claim on listing ab seeded in TEST 5)
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000002', true);

-- Seed a review on listing ab first (bypass RLS as postgres)
RESET ROLE;
INSERT INTO public.reviews (id, listing_id, user_id, rating, content)
VALUES ('00000000-0005-0000-0000-000000000099',
        '00000000-0005-0000-0000-0000000000ab',
        '00000000-0005-0000-0000-000000000001',
        4, 'test review for owner reply');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000002', true);

SELECT lives_ok(
  $$INSERT INTO public.review_responses (review_id, listing_id, content, user_id)
    VALUES ('00000000-0005-0000-0000-000000000099',
            '00000000-0005-0000-0000-0000000000ab',
            'Thank you for your feedback!',
            '00000000-0005-0000-0000-000000000002')$$,
  'review_responses: verified owner can insert a response'
);

-- ----------------------------------------------------------------
-- TEST 13: public.decide_claim — atomic decision happy path
-- Seed a pending claim with a verification_document_url, call decide_claim
-- as superuser (RESET ROLE), then assert all fields and audit row.
-- NOTE: run deferred (no local DB). pg_prove when $LOCAL_TEST_DB + pg_prove available.
-- ----------------------------------------------------------------
RESET ROLE;

-- Seed an admin user (both auth + public)
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES (
  '00000000-0005-0000-0000-000000000009',
  'admin_decide@test.internal', NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'
);
INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES ('00000000-0005-0000-0000-000000000009', 'admin_decide', 'admin', 0, 'expert', true);

-- Seed a consumer user to be the claimant
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES (
  '00000000-0005-0000-0000-000000000010',
  'claimant_d@test.internal', NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated'
);
INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES ('00000000-0005-0000-0000-000000000010', 'claimant_d', 'consumer', 0, 'novice', true);

-- Seed a listing for the claim
INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0005-0000-0000-0000000000ac', 'decide-biz', 'Decide Test Biz', 'business', '34', 'active');

-- Seed a pending claim with a verification_document_url
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status, verification_document_url)
VALUES (
  '00000000-0005-0000-0000-000000000d01',
  '00000000-0005-0000-0000-0000000000ac',
  '00000000-0005-0000-0000-000000000010',
  'owner', 'pending', 'bilinc-verification/videos/claim_d01.mp4'
);

-- Call decide_claim as the seeded admin user so is_admin(auth.uid()) passes.
-- (After the security fix, superuser/postgres has auth.uid()=NULL and would fail.)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000009', true);

PERFORM public.decide_claim(
  '00000000-0005-0000-0000-000000000d01'::UUID,
  'verified',
  '00000000-0005-0000-0000-000000000009'::UUID
);

RESET ROLE;

SELECT is(
  (SELECT status FROM public.listing_claims WHERE id = '00000000-0005-0000-0000-000000000d01'),
  'verified',
  'decide_claim: status set to verified'
);

SELECT is(
  (SELECT verified_by FROM public.listing_claims WHERE id = '00000000-0005-0000-0000-000000000d01'),
  '00000000-0005-0000-0000-000000000009'::UUID,
  'decide_claim: verified_by set to admin id'
);

SELECT isnt(
  (SELECT decided_at FROM public.listing_claims WHERE id = '00000000-0005-0000-0000-000000000d01'),
  NULL,
  'decide_claim: decided_at IS NOT NULL'
);

SELECT ok(
  (SELECT expires_at FROM public.listing_claims WHERE id = '00000000-0005-0000-0000-000000000d01') > now(),
  'decide_claim: expires_at is in the future (now + 1 year)'
);

SELECT is(
  (SELECT verification_document_url FROM public.listing_claims WHERE id = '00000000-0005-0000-0000-000000000d01'),
  NULL,
  'decide_claim: verification_document_url nulled after decision'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.claim_audit WHERE claim_id = '00000000-0005-0000-0000-000000000d01'),
  1,
  'decide_claim: claim_audit row inserted for claim'
);

SELECT is(
  (SELECT decision FROM public.claim_audit WHERE claim_id = '00000000-0005-0000-0000-000000000d01'),
  'verified',
  'decide_claim: claim_audit.decision = verified'
);

SELECT is(
  (SELECT object_path FROM public.claim_audit WHERE claim_id = '00000000-0005-0000-0000-000000000d01'),
  'bilinc-verification/videos/claim_d01.mp4',
  'decide_claim: claim_audit.object_path retains original doc path for audit'
);

-- ----------------------------------------------------------------
-- TEST 14: Non-admin authenticated user CANNOT call decide_claim
-- Regression for CVE-class privilege-escalation: any authenticated user
-- could self-verify their claim and self-promote to business_owner via
-- SECURITY DEFINER before the is_admin guard was added.
-- ----------------------------------------------------------------
-- Seed a second pending claim owned by consumer_c (uid 001) for decide-biz
RESET ROLE;
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status)
VALUES (
  '00000000-0005-0000-0000-000000000d02',
  '00000000-0005-0000-0000-0000000000ac',
  '00000000-0005-0000-0000-000000000001',
  'owner', 'pending'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0005-0000-0000-000000000001', true);

SELECT throws_ok(
  $$ SELECT public.decide_claim(
       '00000000-0005-0000-0000-000000000d02'::UUID,
       'verified',
       '00000000-0005-0000-0000-000000000001'::UUID
     ) $$,
  '42501',
  'decide_claim: non-admin authenticated user is rejected with 42501 (priv-esc regression)'
);

RESET ROLE;

-- ----------------------------------------------------------------
-- TEST 15: Re-claim cooldown — within 14 days of rejection is blocked
-- Trigger: trg_claim_cooldown (claim_cooldown.sql, runs AFTER decide_claim.sql)
-- NOTE: run deferred (no local DB). pg_prove when $LOCAL_TEST_DB + pg_prove available.
-- Seeds are under RESET ROLE (superuser) so RLS does not interfere — we are
-- testing the BEFORE INSERT trigger, not RLS.
-- ----------------------------------------------------------------
RESET ROLE;

-- Seed two fresh users for isolation (won't collide with pending-unique index)
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0015-0000-0000-000000000001',
   'cooldown_user@test.internal', NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   false, crypt('pw', gen_salt('bf')), 'authenticated', 'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0015-0000-0000-000000000001', 'cooldown_user', 'consumer', 0, 'novice', true);

-- Seed a fresh listing exclusively for cooldown tests
INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES
  ('00000000-0015-0000-0000-0000000000aa', 'cooldown-biz', 'Cooldown Test Biz', 'business', '34', 'active');

-- Seed a rejected claim with decided_at = now() (within 14-day window)
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status, decided_at)
VALUES (
  '00000000-0015-0000-0000-000000000c01',
  '00000000-0015-0000-0000-0000000000aa',
  '00000000-0015-0000-0000-000000000001',
  'owner', 'rejected', now()
);

-- Attempt to file a new pending claim for the same user+listing — must be blocked
SELECT throws_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0015-0000-0000-0000000000aa',
            '00000000-0015-0000-0000-000000000001',
            'owner', 'pending')$$,
  '23514',
  'claim_cooldown: pending insert within 14-day rejection window must raise check_violation'
);

-- ----------------------------------------------------------------
-- TEST 16: Re-claim cooldown — after 14 days a new pending claim IS allowed
-- ----------------------------------------------------------------
RESET ROLE;

-- Seed a second listing to avoid unique-index collision with TEST 15 seed
INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES
  ('00000000-0015-0000-0000-0000000000ab', 'cooldown-biz-2', 'Cooldown Test Biz 2', 'business', '06', 'active');

-- Seed a rejected claim with decided_at older than 14 days (outside cooldown window)
INSERT INTO public.listing_claims (id, listing_id, user_id, role, status, decided_at)
VALUES (
  '00000000-0015-0000-0000-000000000c02',
  '00000000-0015-0000-0000-0000000000ab',
  '00000000-0015-0000-0000-000000000001',
  'owner', 'rejected', now() - INTERVAL '15 days'
);

-- A new pending claim should succeed (cooldown expired)
SELECT lives_ok(
  $$INSERT INTO public.listing_claims (listing_id, user_id, role, status)
    VALUES ('00000000-0015-0000-0000-0000000000ab',
            '00000000-0015-0000-0000-000000000001',
            'owner', 'pending')$$,
  'claim_cooldown: pending insert succeeds when prior rejection is older than 14 days'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
