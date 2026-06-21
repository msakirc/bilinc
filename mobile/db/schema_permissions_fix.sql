-- =====================================================
-- FIX: PRIVATE SCHEMA PERMISSIONS
-- =====================================================
-- Date: 2026-03-31
-- Issue: Triggers on reviews/facts tables call functions
-- in the 'private' schema (update_listing_stats,
-- update_user_reputation). These fail because the
-- authenticated and service_role roles don't have
-- USAGE permission on the private schema.
--
-- Without this fix:
-- - Review submissions fail with "permission denied for schema private"
-- - Fact submissions may also fail if they have similar triggers
-- - The tağşiş scraper cannot insert reviews via service_role
--
-- Affected triggers:
-- - reviews.update_listing_stats_on_review -> private.update_listing_stats()
-- - reviews.update_reputation_on_review -> private.update_user_reputation()
--
-- The private schema is intentionally hidden from 'anon' role
-- (unauthenticated users cannot call these functions directly).
-- Only authenticated users (via triggers) and service_role need access.
-- =====================================================

-- Grant schema usage to roles that need trigger access
GRANT USAGE ON SCHEMA private TO service_role, authenticated;

-- Grant execute on all current and future functions in private schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role, authenticated;

-- Ensure future functions in private schema also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  GRANT EXECUTE ON FUNCTIONS TO service_role, authenticated;
