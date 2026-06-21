-- =====================================================
-- claim_submit_flow.sql — enable the ownership-claim SUBMIT path
-- (handoff 07). Run AFTER the base order + storage_verification_bucket.sql.
-- Idempotent.
--
-- WHY: the claim *destination* (business panel, gated by user_type=
-- 'business_owner') was built, but the *door* was not. A user only BECOMES a
-- business_owner by having a claim verified — so the old insert policy
-- (which required user_type='business_owner') was a chicken-and-egg deadlock:
-- nobody could ever file the first claim. This migration lets any
-- authenticated user file a PENDING claim for themselves; an admin verifying
-- it is what promotes them to business_owner.
-- =====================================================

-- --------------------------------------------------------------------------
-- 1. Columns: VKN (low-PII business tax id, cross-checkable) + KVKK consent.
--    tax_number is NOT high-PII like a doc scan; kept for verification &
--    audit. consent_at records açık rıza for any uploaded document.
-- --------------------------------------------------------------------------
ALTER TABLE public.listing_claims
  ADD COLUMN IF NOT EXISTS tax_number TEXT,
  ADD COLUMN IF NOT EXISTS consent_at  TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- 2. Insert policy: replace the business_owner-only gate with self-service.
--    Any authenticated user may file a claim for THEMSELVES, but only in the
--    'pending' state — they cannot self-grant 'verified'. The unique partial
--    indexes (one pending per user/listing, one verified owner per listing)
--    still apply.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "listing_claims_insert_business" ON public.listing_claims;
DROP POLICY IF EXISTS "listing_claims_insert_self"     ON public.listing_claims;
CREATE POLICY "listing_claims_insert_self" ON public.listing_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- --------------------------------------------------------------------------
-- 3. Retention sweeper (belt-and-suspenders; app deletes docs on decision).
--    a) stale 'pending' claims older than 30d → 'expired'
--    b) terminal claims (rejected/revoked/expired) still holding a doc path
--       older than 7d → drop the storage object row + null the column, so no
--       legal paperwork lingers (KVKK retention). The primary delete path is
--       the app on the verify/reject decision; this catches orphans.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sweep_stale_claims()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, private
AS $$
BEGIN
  -- a) expire stale pending claims
  UPDATE public.listing_claims
     SET status = 'expired'
   WHERE status = 'pending'
     AND requested_at < NOW() - INTERVAL '30 days';

  -- b) purge orphaned verification docs for terminal claims
  DELETE FROM storage.objects o
   USING public.listing_claims c
   WHERE c.verification_document_url IS NOT NULL
     AND c.status IN ('rejected', 'revoked', 'expired')
     AND c.verified_at < NOW() - INTERVAL '7 days'
     AND o.bucket_id = 'bilinc-verification'
     AND o.name = c.verification_document_url;

  UPDATE public.listing_claims
     SET verification_document_url = NULL
   WHERE verification_document_url IS NOT NULL
     AND status IN ('rejected', 'revoked', 'expired')
     AND verified_at < NOW() - INTERVAL '7 days';
END;
$$;

-- --------------------------------------------------------------------------
-- 4. Schedule the sweeper daily (only if pg_cron is installed — same guard
--    pattern as schedule_refresh.sql).
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('sweep-stale-claims')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-claims');
    PERFORM cron.schedule(
      'sweep-stale-claims',
      '17 3 * * *',                       -- daily 03:17
      $cron$ SELECT private.sweep_stale_claims(); $cron$
    );
  END IF;
END;
$$;
