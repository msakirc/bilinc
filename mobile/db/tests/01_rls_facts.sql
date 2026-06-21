-- ================================================================
-- 01_rls_facts.sql — RLS policy: facts_insert_qualified (100-pt gate)
-- ================================================================
-- Policy tested (exact name from more_fixes.sql, final definition):
--   "facts_insert_qualified" ON facts FOR INSERT
--   WITH CHECK (auth.uid() = user_id AND public.get_user_reputation(auth.uid()) >= 100)
--
-- Fact category CHECK constraint (final after fix_fact_categories.sql):
--   category IN ('safety','ownership','health','quality','legal',
--                'environmental','abuse','labor','other')
--
-- All work is wrapped in BEGIN/ROLLBACK — no committed rows left.
-- ================================================================
BEGIN;

SELECT plan(8);

-- ----------------------------------------------------------------
-- Seed: two auth.users + public.users rows + one listing
-- UUIDs are deterministic short values to avoid collisions.
-- ----------------------------------------------------------------
-- Auth users: pgTAP tests need rows in auth.users for auth.uid()
-- mapping. We insert directly (test project has no signup guard
-- from service-role perspective — but since we are running as
-- postgres role the RLS bypass lets us insert reference rows).
INSERT INTO auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, encrypted_password, aud, role)
VALUES
  ('00000000-0001-0000-0000-000000000001',
   'lowrep@test.internal',
   NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb,
   false,
   crypt('testpass1', gen_salt('bf')),
   'authenticated',
   'authenticated'),
  ('00000000-0001-0000-0000-000000000002',
   'highrep@test.internal',
   NOW(), NOW(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{}'::jsonb,
   false,
   crypt('testpass2', gen_salt('bf')),
   'authenticated',
   'authenticated');

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES
  ('00000000-0001-0000-0000-000000000001', 'lowrep_user',  'consumer', 10,  'novice',      true),
  ('00000000-0001-0000-0000-000000000002', 'highrep_user', 'consumer', 100, 'contributor', true);

-- A minimal standalone listing (entity_type='business', city_code set, no parent)
INSERT INTO public.listings (id, slug, name, entity_type, city_code, status)
VALUES ('00000000-0001-0000-0000-0000000000aa', 'test-biz-01', 'Test Business 01', 'business', '34', 'active');

-- ----------------------------------------------------------------
-- TEST 1: reputation < 100 → INSERT blocked by facts_insert_qualified
-- ----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0001-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000001',
            'Unsafe kitchen', 'safety', true)$$,
  NULL,
  'rep=10 < 100: facts_insert_qualified must block the INSERT'
);

-- ----------------------------------------------------------------
-- TEST 2: user_id spoofing blocked — low-rep user cannot claim they
-- are the high-rep user (auth.uid() = user_id check)
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Spoofed user_id', 'safety', true)$$,
  NULL,
  'user_id spoofing: authenticated as low-rep, cannot insert as high-rep user_id'
);

-- ----------------------------------------------------------------
-- Switch to high-rep user (rep=100)
-- ----------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0001-0000-0000-000000000002', true);

-- ----------------------------------------------------------------
-- TEST 3: rep = 100 exactly → INSERT allowed
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Verified food prep claim', 'safety', true)$$,
  'rep=100 (exact threshold): facts_insert_qualified must allow INSERT'
);

-- ----------------------------------------------------------------
-- TEST 4: invalid category → CHECK constraint violation
-- ----------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Bad category test', 'invalid_category_xyz', true)$$,
  '23514',  -- check_violation SQLSTATE
  'invalid category: facts_category_check constraint must reject it'
);

-- ----------------------------------------------------------------
-- TEST 5: 'abuse' category accepted (added in fix_fact_categories.sql)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Owner verbally abused staff', 'abuse', true)$$,
  'category=abuse: must be accepted after fix_fact_categories.sql'
);

-- ----------------------------------------------------------------
-- TEST 6: 'labor' category accepted (added in fix_fact_categories.sql)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Workers paid below minimum wage', 'labor', true)$$,
  'category=labor: must be accepted after fix_fact_categories.sql'
);

-- ----------------------------------------------------------------
-- TEST 7: 'ownership' category accepted (original set)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category, truth_guarantee)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Ownership changed in 2024', 'ownership', true)$$,
  'category=ownership: original category still accepted'
);

-- ----------------------------------------------------------------
-- TEST 8: truth_guarantee NOT NULL — omitting it should default true
-- (column DEFAULT TRUE — verify insert without explicit value succeeds)
-- ----------------------------------------------------------------
SELECT lives_ok(
  $$INSERT INTO public.facts (listing_id, user_id, statement, category)
    VALUES ('00000000-0001-0000-0000-0000000000aa',
            '00000000-0001-0000-0000-000000000002',
            'Claim without explicit truth_guarantee', 'health')$$,
  'truth_guarantee defaults to TRUE when omitted'
);

SELECT * FROM finish();
ROLLBACK;
