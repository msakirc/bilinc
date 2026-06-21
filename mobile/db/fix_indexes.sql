-- Performance indexes for hot query paths
-- Date: 2026-04-05
-- Target: browse_category, search_listings, search_suggestions, get_category_counts

-- 1. Composite index for browse_category: JOIN listing_categories ON listing_id, filter by category_id
--    Existing idx_listing_categories_category is (category_id) only — adding listing_id covers the join
CREATE INDEX IF NOT EXISTS idx_lc_category_listing
ON listing_categories(category_id, listing_id);

-- 2. Composite for primary category lookups (search_listings, search_suggestions)
--    These filter: lc.listing_id = l.id AND lc.is_primary = true
CREATE INDEX IF NOT EXISTS idx_lc_listing_primary
ON listing_categories(listing_id, is_primary) WHERE is_primary = true;

-- 3. Covering index for listings status + rating + reviews (used in ORDER BY across all functions)
CREATE INDEX IF NOT EXISTS idx_listings_active_rating
ON listings(average_rating DESC NULLS LAST, total_reviews DESC) WHERE status = 'active';

-- 4. Listing photos: covering index for the correlated subquery in every function
--    (SELECT url FROM listing_photos WHERE listing_id = ? AND is_primary = true AND status = 'active' LIMIT 1)
CREATE INDEX IF NOT EXISTS idx_listing_photos_primary_active
ON listing_photos(listing_id, is_primary, status) WHERE is_primary = true AND status = 'active';

-- 5. Categories parent_id for the IN (SELECT id FROM categories WHERE parent_id = ?) subquery
--    idx_categories_parent exists but let's make sure it's correct
-- Already exists: idx_categories_parent

-- 6. Listings name trigram index for search_suggestions LIKE '%query%'
--    Requires pg_trgm extension (should already be enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listings_name_trgm
ON listings USING gin(lower(name) gin_trgm_ops) WHERE status = 'active';
