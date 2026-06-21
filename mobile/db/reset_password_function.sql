-- =====================================================
-- PASSWORD RESET VIA SECURITY QUESTIONS
-- =====================================================
-- The mobile app (app/(auth)/reset-password.tsx) implements a 3-step flow:
--   1. get_security_questions(username)          -> returns the 2 questions
--   2. verify_security_answers(username, a1, a2) -> returns a reset_token UUID
--   3. reset_password_with_token(username, token, new_password)
--
-- PROBLEM (token mechanism): in tables.sql the original
-- verify_security_answers() *generates* a reset_token UUID but never persists
-- it anywhere, and reset_password_with_token() does not exist. A Supabase anon
-- client cannot update auth.users.encrypted_password directly, so the actual
-- password change must happen inside a SECURITY DEFINER function.
--
-- This file:
--   1. Adds token storage columns to public.user_security (idempotent).
--   2. Re-creates verify_security_answers() so that, on success, it persists
--      the issued token + a short expiry alongside the user.
--   3. Creates reset_password_with_token() which validates the token, updates
--      auth.users.encrypted_password via pgcrypto's crypt()/gen_salt('bf'),
--      and burns the token so it cannot be reused.
--
-- Run order: after tables.sql (this re-creates verify_security_answers, so it
-- must run after the original definition exists). Idempotent / safe to re-run.
-- =====================================================

-- pgcrypto provides crypt() and gen_salt(); already created in tables.sql but
-- declared again here so this file is self-contained.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. TOKEN STORAGE COLUMNS
-- =====================================================
-- We store the most recently issued reset token (and its expiry) directly on
-- the user_security row. A token is single-use: it is cleared on success and
-- expires after a short window.
ALTER TABLE public.user_security
  ADD COLUMN IF NOT EXISTS reset_token UUID;

ALTER TABLE public.user_security
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- =====================================================
-- 2. RE-CREATE verify_security_answers (persist the token)
-- =====================================================
-- Identical signature/behaviour to tables.sql, except that on a successful
-- verification we now persist the issued token + a 15 minute expiry so that
-- reset_password_with_token() can validate it.
CREATE OR REPLACE FUNCTION public.verify_security_answers(
  p_username TEXT,
  p_answer_1 TEXT,
  p_answer_2 TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT, reset_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_stored_hash_1 TEXT;
  v_stored_hash_2 TEXT;
  v_failed_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_reset_token UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT
    security_answer_1_hash,
    security_answer_2_hash,
    us.failed_attempts,
    us.locked_until
  INTO v_stored_hash_1, v_stored_hash_2, v_failed_attempts, v_locked_until
  FROM public.user_security us
  WHERE us.user_id = v_user_id;

  IF v_stored_hash_1 IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Security questions not set'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN QUERY SELECT FALSE,
      format('Account locked. Try again after %s', v_locked_until)::TEXT,
      NULL::UUID;
    RETURN;
  END IF;

  IF crypt(lower(trim(p_answer_1)), v_stored_hash_1) = v_stored_hash_1
     AND crypt(lower(trim(p_answer_2)), v_stored_hash_2) = v_stored_hash_2 THEN

    v_reset_token := uuid_generate_v4();

    -- Reset the lock counters AND persist the single-use token (15 min expiry).
    UPDATE public.user_security
    SET failed_attempts = 0,
        locked_until = NULL,
        reset_token = v_reset_token,
        reset_token_expires_at = NOW() + INTERVAL '15 minutes'
    WHERE user_id = v_user_id;

    RETURN QUERY SELECT TRUE, 'Verification successful'::TEXT, v_reset_token;
  ELSE
    v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

    UPDATE public.user_security us
    SET
      failed_attempts = v_failed_attempts,
      locked_until = CASE
        WHEN v_failed_attempts >= 5 THEN NOW() + INTERVAL '30 minutes'
        WHEN v_failed_attempts >= 3 THEN NOW() + INTERVAL '5 minutes'
        ELSE NULL
      END
    WHERE us.user_id = v_user_id;

    IF v_failed_attempts >= 5 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 30 minutes'::TEXT, NULL::UUID;
    ELSIF v_failed_attempts >= 3 THEN
      RETURN QUERY SELECT FALSE, 'Too many attempts. Account locked for 5 minutes'::TEXT, NULL::UUID;
    ELSE
      RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT, NULL::UUID;
    END IF;
  END IF;
END;
$$;

-- =====================================================
-- 3. reset_password_with_token
-- =====================================================
-- Validates the (username, token) pair issued by verify_security_answers,
-- then updates the auth.users password and burns the token.
--
-- SECURITY DEFINER is mandatory: the function owner (typically the postgres
-- role) is allowed to write auth.users; the anon caller is not. We keep the
-- function tight: it only ever touches the single matching user row, validates
-- token freshness, enforces a minimum password length, and clears the token on
-- success so it cannot be replayed.
CREATE OR REPLACE FUNCTION public.reset_password_with_token(
  p_username TEXT,
  p_reset_token UUID,
  p_new_password TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_stored_token UUID;
  v_token_expires TIMESTAMPTZ;
BEGIN
  IF p_reset_token IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid or missing reset token'::TEXT;
    RETURN;
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RETURN QUERY SELECT FALSE, 'Password must be at least 8 characters'::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_user_id
  FROM public.users
  WHERE username = lower(trim(p_username))
  AND is_active = true;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;

  SELECT reset_token, reset_token_expires_at
  INTO v_stored_token, v_token_expires
  FROM public.user_security
  WHERE user_id = v_user_id;

  -- Token must exist, match, and still be valid.
  IF v_stored_token IS NULL
     OR v_stored_token <> p_reset_token
     OR v_token_expires IS NULL
     OR v_token_expires < NOW() THEN
    RETURN QUERY SELECT FALSE, 'Reset token is invalid or expired'::TEXT;
    RETURN;
  END IF;

  -- Update the Supabase Auth password. encrypted_password uses bcrypt, which
  -- pgcrypto's crypt(..., gen_salt('bf')) produces. Note: extensions.crypt /
  -- public.crypt resolve to the same pgcrypto implementation; we rely on the
  -- search_path-resolved crypt() here (pgcrypto installed in tables.sql).
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Burn the token (single use) and reset any lockout state.
  UPDATE public.user_security
  SET reset_token = NULL,
      reset_token_expires_at = NULL,
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN QUERY SELECT TRUE, 'Password reset successful'::TEXT;
END;
$$;

-- =====================================================
-- 4. GRANTS
-- =====================================================
-- The reset flow is used by unauthenticated (anon) users who have forgotten
-- their password, so anon + authenticated must be able to execute it.
GRANT EXECUTE ON FUNCTION public.verify_security_answers(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT, UUID, TEXT) TO anon, authenticated;
