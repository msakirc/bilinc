-- mobile/db/claim_cooldown.sql — block re-claim within 14 days of a rejection. Idempotent.
-- Run AFTER verification_video_method.sql (decided_at) + decide_claim.sql.
CREATE OR REPLACE FUNCTION public.enforce_claim_cooldown() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.listing_claims
              WHERE user_id = NEW.user_id AND listing_id = NEW.listing_id
                AND status = 'rejected' AND decided_at > now() - INTERVAL '14 days') THEN
    RAISE EXCEPTION 'claim_cooldown: a rejected claim for this listing is within the 14-day cooldown'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_claim_cooldown ON public.listing_claims;
CREATE TRIGGER trg_claim_cooldown BEFORE INSERT ON public.listing_claims
  FOR EACH ROW WHEN (NEW.status = 'pending') EXECUTE FUNCTION public.enforce_claim_cooldown();
