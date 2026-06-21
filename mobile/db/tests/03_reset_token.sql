-- ================================================================
-- 03_reset_token.sql — Password reset: verify_security_answers + reset_password_with_token
-- ================================================================
-- Functions tested (from reset_password_function.sql):
--
--   verify_security_answers(p_username TEXT, p_answer_1 TEXT, p_answer_2 TEXT)
--   RETURNS TABLE(success BOOLEAN, message TEXT, reset_token UUID)
--   — correct answers: issues token persisted in user_security.reset_token
--     with reset_token_expires_at = NOW() + 15 minutes
--   — wrong answers: increments failed_attempts; at >=3 locks for 5min,
--     at >=5 locks for 30min
--   — locked: returns FALSE message containing 'locked'
--
--   reset_password_with_token(p_username TEXT, p_reset_token UUID, p_new_password TEXT)
--   RETURNS TABLE(success BOOLEAN, message TEXT)
--   — valid token: updates auth.users.encrypted_password, burns the token,
--     returns TRUE
--   — replay (token already burned/NULL): returns FALSE
--   — expired token (reset_token_expires_at in the past): returns FALSE
--   — password < 8 chars: returns FALSE
--
-- Both functions are SECURITY DEFINER so they can be called by anon role.
-- We test them via RESET ROLE (postgres) since we also need to seed
-- auth.users and user_security rows directly.
--
-- FINDING: verify_security_answers() does NOT insert a row into auth.users or
-- public.users — those must pre-exist. This test seeds them directly.
-- ================================================================
BEGIN;

SELECT plan(10);

-- ----------------------------------------------------------------
-- Seed: one auth.users row + public.users + user_security
-- ----------------------------------------------------------------
INSERT INTO auth.users (id, email, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, encrypted_password, aud, role)
VALUES (
  '00000000-0003-0000-0000-000000000001',
  'reset_user@test.internal',
  NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  crypt('OldPassword1', gen_salt('bf')),
  'authenticated', 'authenticated'
);

INSERT INTO public.users (id, username, user_type, reputation_score, credibility_level, is_active)
VALUES ('00000000-0003-0000-0000-000000000001', 'reset_test_user', 'consumer', 0, 'novice', true);

-- set_security_questions is SECURITY DEFINER and reads auth.uid() — call directly
-- as the user to set up security questions.
-- We bypass it and insert into user_security directly for seeding clarity.
INSERT INTO public.user_security
    (user_id, security_question_1, security_answer_1_hash,
                security_question_2, security_answer_2_hash,
     failed_attempts, locked_until)
VALUES (
  '00000000-0003-0000-0000-000000000001',
  'What is your pet name?',
  crypt('fluffy', gen_salt('bf', 10)),
  'What city were you born in?',
  crypt('ankara', gen_salt('bf', 10)),
  0,
  NULL
);

-- ----------------------------------------------------------------
-- TEST 1: Correct answers → success=true and reset_token IS NOT NULL
-- ----------------------------------------------------------------
SELECT is(
  (SELECT success FROM public.verify_security_answers('reset_test_user', 'fluffy', 'ankara')),
  true,
  'correct answers: verify_security_answers must return success=true'
);

-- ----------------------------------------------------------------
-- TEST 2: Issued reset_token is persisted in user_security
-- ----------------------------------------------------------------
SELECT isnt(
  (SELECT reset_token FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
  NULL,
  'correct answers: reset_token must be persisted in user_security row'
);

-- ----------------------------------------------------------------
-- TEST 3: Wrong answers increment failed_attempts
-- ----------------------------------------------------------------
-- First, burn the current token so subsequent calls do not interfere
UPDATE public.user_security
SET reset_token = NULL, reset_token_expires_at = NULL, failed_attempts = 0
WHERE user_id = '00000000-0003-0000-0000-000000000001';

-- Submit wrong answers twice (attempts 1 and 2 — no lock yet)
PERFORM public.verify_security_answers('reset_test_user', 'wrong1', 'wrong2');
PERFORM public.verify_security_answers('reset_test_user', 'wrong1', 'wrong2');

SELECT is(
  (SELECT failed_attempts FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
  2,
  'two wrong attempts: failed_attempts must equal 2'
);

-- ----------------------------------------------------------------
-- TEST 4: Third wrong attempt triggers lock (>=3 → locked_until IS NOT NULL)
-- ----------------------------------------------------------------
PERFORM public.verify_security_answers('reset_test_user', 'wrong1', 'wrong2');

SELECT isnt(
  (SELECT locked_until FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
  NULL,
  '3rd wrong attempt: locked_until must be set (5-min lock threshold is 3)'
);

-- ----------------------------------------------------------------
-- TEST 5: While locked, even correct answers are rejected
-- ----------------------------------------------------------------
SELECT is(
  (SELECT success FROM public.verify_security_answers('reset_test_user', 'fluffy', 'ankara')),
  false,
  'while locked: correct answers still return success=false'
);

-- ----------------------------------------------------------------
-- Clear lock for remaining tests
-- ----------------------------------------------------------------
UPDATE public.user_security
SET failed_attempts = 0, locked_until = NULL,
    reset_token = NULL, reset_token_expires_at = NULL
WHERE user_id = '00000000-0003-0000-0000-000000000001';

-- ----------------------------------------------------------------
-- TEST 6: reset_password_with_token with password < 8 chars → failure
-- (function checks this before touching anything)
-- ----------------------------------------------------------------
SELECT is(
  (SELECT success FROM public.reset_password_with_token('reset_test_user', gen_random_uuid(), 'short')),
  false,
  'password < 8 chars: reset_password_with_token must return success=false'
);

-- ----------------------------------------------------------------
-- TEST 7: reset_password_with_token with a wrong/random token → failure
-- ----------------------------------------------------------------
SELECT is(
  (SELECT success FROM public.reset_password_with_token('reset_test_user', gen_random_uuid(), 'ValidPass123')),
  false,
  'wrong token: reset_password_with_token must return success=false'
);

-- ----------------------------------------------------------------
-- TEST 8: valid token → reset succeeds
-- ----------------------------------------------------------------
DO $$
DECLARE v_token UUID;
BEGIN
  SELECT reset_token INTO v_token
  FROM public.verify_security_answers('reset_test_user', 'fluffy', 'ankara');

  UPDATE public.user_security
  SET reset_token = v_token
  WHERE user_id = '00000000-0003-0000-0000-000000000001';
END $$;

SELECT is(
  (
    SELECT success
    FROM public.reset_password_with_token(
      'reset_test_user',
      (SELECT reset_token FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
      'NewPassword99'
    )
  ),
  true,
  'valid token + valid password: reset_password_with_token must return success=true'
);

-- ----------------------------------------------------------------
-- TEST 9: After successful reset, token is burned (replay rejected)
-- ----------------------------------------------------------------
-- The previous call burned the token; calling again with a fresh
-- attempt using a captured-before-burn token UUID should fail.
-- We re-read: token should be NULL after the successful reset.
SELECT is(
  (SELECT reset_token FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
  NULL,
  'after successful reset: reset_token must be NULL (burned)'
);

-- ----------------------------------------------------------------
-- TEST 10: Expired token rejected
-- ----------------------------------------------------------------
-- Plant an already-expired token
UPDATE public.user_security
SET reset_token = gen_random_uuid(),
    reset_token_expires_at = NOW() - INTERVAL '1 second'
WHERE user_id = '00000000-0003-0000-0000-000000000001';

SELECT is(
  (
    SELECT success
    FROM public.reset_password_with_token(
      'reset_test_user',
      (SELECT reset_token FROM public.user_security WHERE user_id = '00000000-0003-0000-0000-000000000001'),
      'ShouldNotWork1'
    )
  ),
  false,
  'expired token: reset_password_with_token must return success=false'
);

SELECT * FROM finish();
ROLLBACK;
