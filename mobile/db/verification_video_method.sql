-- mobile/db/verification_video_method.sql
-- Extend verification_method to the canonical vocabulary (handoff 06) and add
-- video capture-metadata sidecar columns + decided_at + legacy flag. Idempotent.
-- Run AFTER claim_submit_flow.sql.
ALTER TABLE public.listing_claims DROP CONSTRAINT IF EXISTS listing_claims_verification_method_check;
ALTER TABLE public.listing_claims
  ADD CONSTRAINT listing_claims_verification_method_check
  CHECK (verification_method IN ('video','edevlet','document','phone','email','domain','admin'));

ALTER TABLE public.listing_claims
  ADD COLUMN IF NOT EXISTS captured_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS captured_lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS captured_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS liveness_nonce   TEXT,
  ADD COLUMN IF NOT EXISTS decided_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_legacy_method BOOLEAN NOT NULL DEFAULT FALSE;

-- Flag pre-existing verified claims that used a now-weak method as legacy
-- (they must re-verify by video to retain reply rights — enforced in app/UI).
UPDATE public.listing_claims SET is_legacy_method = TRUE
 WHERE status = 'verified' AND verification_method <> 'video';
