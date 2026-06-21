-- =====================================================
-- SCHEDULE MATERIALIZED VIEW REFRESH
-- =====================================================
-- Search / browse return stale (often zero) rows until the materialized views
-- are refreshed. tables.sql + fixes.sql define refresh_materialized_views(),
-- but nothing ever calls it on a schedule.
--
-- After the full run order, the actual MATERIALIZED VIEWS are:
--   * company_stats   (fixes.sql)
--   * brand_stats     (fixes.sql)
--   * category_stats  (tables.sql, kept by fixes.sql)
-- NOTE: listing_full is a *regular* VIEW (re-created in fixes.sql), so it is
-- always live and must NOT be refreshed.
--
-- This file:
--   1. Refreshes every matview ONCE right now so search works immediately.
--   2. Schedules refresh_materialized_views() every 10 minutes via pg_cron,
--      IF the pg_cron extension is available on this Supabase plan.
--   3. Documents the fallback (Supabase Scheduled Edge Function / manual) for
--      plans where pg_cron is not available.
--
-- Run order: after fixes.sql (needs company_stats / brand_stats to exist).
-- Idempotent / safe to re-run.
-- =====================================================

-- =====================================================
-- 1. IMMEDIATE ONE-TIME REFRESH (so search works NOW)
-- =====================================================
-- Plain (non-CONCURRENTLY) refresh: works even if the unique indexes are
-- missing and even on a brand-new / never-populated matview.
REFRESH MATERIALIZED VIEW company_stats;
REFRESH MATERIALIZED VIEW brand_stats;
REFRESH MATERIALIZED VIEW category_stats;

-- =====================================================
-- 2. SCHEDULE VIA pg_cron (every 10 minutes)
-- =====================================================
-- pg_cron is available on Supabase but must be enabled. On the Supabase
-- dashboard: Database > Extensions > enable "pg_cron". This block attempts to
-- enable it and register the job; if the extension cannot be created (plan
-- restriction / insufficient privilege), it raises a NOTICE and falls through
-- to the documented fallback below instead of failing the whole script.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Remove any previous copy of this job so re-running stays idempotent.
  PERFORM cron.unschedule('refresh_materialized_views')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh_materialized_views'
  );

  PERFORM cron.schedule(
    'refresh_materialized_views',
    '*/10 * * * *',
    $cron$ SELECT public.refresh_materialized_views(); $cron$
  );

  RAISE NOTICE 'pg_cron job "refresh_materialized_views" scheduled (every 10 min).';
EXCEPTION
  WHEN insufficient_privilege OR feature_not_supported OR undefined_function OR undefined_table THEN
    RAISE NOTICE 'pg_cron not available on this plan. Use the fallback documented in this file.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job (%). Use the documented fallback.', SQLERRM;
END;
$$;

-- =====================================================
-- 3. FALLBACK (when pg_cron is unavailable)
-- =====================================================
-- Option A — Supabase Scheduled Edge Function:
--   1. supabase functions new refresh-views
--   2. In the function, call the RPC with the service-role key:
--        const { error } = await supabase.rpc('refresh_materialized_views');
--   3. Add a schedule in supabase/config.toml (or the dashboard) with a cron
--      expression, e.g. "*/10 * * * *".
--
-- Option B — External cron (GitHub Actions / cron-job.org) hitting the RPC:
--   curl -X POST \
--     "$SUPABASE_URL/rest/v1/rpc/refresh_materialized_views" \
--     -H "apikey: $SUPABASE_SERVICE_KEY" \
--     -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
--     -H "Content-Type: application/json"
--
-- Option C — Manual (dev only):
--   SELECT public.refresh_materialized_views();
-- =====================================================
