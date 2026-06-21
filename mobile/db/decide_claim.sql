-- mobile/db/decide_claim.sql — atomic claim decision + minimal audit retention. Idempotent.
-- Run AFTER verification_video_method.sql (which adds listing_claims.decided_at).
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.claim_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.listing_claims(id) ON DELETE CASCADE,
  decided_by UUID NOT NULL, decision TEXT NOT NULL,
  object_path TEXT, decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.claim_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS claim_audit_admin ON public.claim_audit;
CREATE POLICY claim_audit_admin ON public.claim_audit
  FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- Defined in `public` (not `private`) so PostgREST exposes it to supabase.rpc('decide_claim')
-- exactly like public.get_admin_stats. Safety comes from the in-function is_admin guard below,
-- NOT from schema obscurity.
CREATE OR REPLACE FUNCTION public.decide_claim(p_claim UUID, p_status TEXT, p_admin UUID, p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage, private AS $$
DECLARE v_user UUID; v_path TEXT;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('verified','rejected','revoked') THEN
    RAISE EXCEPTION 'invalid decision status: %', p_status USING ERRCODE = '22023';
  END IF;
  p_admin := auth.uid();  -- never trust the caller-supplied admin id; record the real actor
  SELECT user_id, verification_document_url INTO v_user, v_path
    FROM public.listing_claims WHERE id = p_claim FOR UPDATE;
  INSERT INTO public.claim_audit (claim_id, decided_by, decision, object_path)
    VALUES (p_claim, p_admin, p_status, v_path);
  UPDATE public.listing_claims SET
    status = p_status, decided_at = now(),
    verified_at = CASE WHEN p_status='verified' THEN now() ELSE verified_at END,
    verified_by = CASE WHEN p_status='verified' THEN p_admin ELSE verified_by END,
    expires_at  = CASE WHEN p_status='verified' THEN now() + INTERVAL '1 year' ELSE expires_at END,
    rejection_reason = COALESCE(p_reason, rejection_reason),
    verification_document_url = NULL
  WHERE id = p_claim;
  IF v_path IS NOT NULL THEN
    DELETE FROM storage.objects WHERE bucket_id='bilinc-verification' AND name=v_path;
  END IF;
  IF p_status='verified' AND v_user IS NOT NULL THEN
    UPDATE public.users SET user_type='business_owner' WHERE id=v_user;
  END IF;
END $$;

-- Matches the per-function grant pattern of other admin-facing RPCs (public.get_admin_stats).
-- Safe despite the authenticated grant because the function body rejects non-admins (42501).
GRANT EXECUTE ON FUNCTION public.decide_claim(UUID, TEXT, UUID, TEXT) TO authenticated;
