-- Drop the problematic trigger that might be causing recursion
DROP TRIGGER IF EXISTS update_reputation_on_review_change ON reviews;
DROP TRIGGER IF EXISTS update_reputation_on_fact_change ON facts;
DROP TRIGGER IF EXISTS update_reputation_on_vote_change ON votes;

-- Drop the functions
DROP FUNCTION IF EXISTS update_user_reputation();
DROP FUNCTION IF EXISTS update_listing_stats();
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS owns_listing(UUID);

-- Disable all RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE facts DISABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE listing_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies from all tables
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;