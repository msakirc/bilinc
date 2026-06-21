-- =====================================================
-- MINISTRY FACTS PIPELINE — schema prerequisites
-- Idempotent. Run after base order. Safe to re-run.
-- =====================================================

-- 1. System author user for official/ministry facts.
--    users.id has no default; username NOT NULL UNIQUE;
--    user_type CHECK in (consumer, business_owner, admin).
INSERT INTO public.users (id, username, user_type)
VALUES ('00000000-0000-0000-0000-000000000001', 'bilinc-resmi', 'admin')
ON CONFLICT (id) DO NOTHING;

-- 2. Listing provenance columns (present only in backup_tables.sql, not base).
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Unique on source_id (non-partial, so ON CONFLICT (source_id) works).
-- Skip if backup_tables.sql's uq_listings_source_id already exists.
-- CAVEAT: if uq_listings_source_id already exists in prod as a PARTIAL index
-- (WHERE source_id IS NOT NULL), ON CONFLICT (source_id) may still fail — in
-- that case the operator must DROP it and recreate it non-partial.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname IN ('uq_listings_source_id', 'listings_source_id_key')
  ) THEN
    CREATE UNIQUE INDEX listings_source_id_key ON public.listings(source_id);
  END IF;
END $$;

-- 3. fact_sources: per-entry idempotency for facts.
CREATE TABLE IF NOT EXISTS public.fact_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id UUID NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_key TEXT NOT NULL,
  source_url TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_key)
);
CREATE INDEX IF NOT EXISTS idx_fact_sources_fact ON public.fact_sources(fact_id);

-- 4. RLS: service-role writes only; public read allowed (facts are public).
ALTER TABLE public.fact_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fact_sources_read ON public.fact_sources;
CREATE POLICY fact_sources_read ON public.fact_sources FOR SELECT USING (true);

-- 5. facts denormalized listing fields (also added by hybrid-migration.sql;
--    declared here so the injector's explicit writes never fail).
ALTER TABLE public.facts ADD COLUMN IF NOT EXISTS listing_name TEXT;
ALTER TABLE public.facts ADD COLUMN IF NOT EXISTS listing_slug TEXT;
