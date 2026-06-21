-- =====================================================
-- FIX: ENTITY RELATIONSHIPS
-- =====================================================

-- 1. Remove the old location constraint (companies don't have locations)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_location_check;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_parent_check;
DROP TRIGGER IF EXISTS listings_validate_parent ON listings;

-- 2. New validation trigger
CREATE OR REPLACE FUNCTION validate_listing_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type TEXT;
  v_parent_has_location BOOLEAN;
BEGIN

  -- ==========================================
  -- CASE 1: No parent
  -- ==========================================
  IF NEW.parent_id IS NULL THEN
    CASE NEW.entity_type
      WHEN 'business' THEN
        -- Allowed: company (no location) or standalone (with location)
        -- No restriction needed
        NULL;
      WHEN 'brand' THEN
        -- Brands MUST have a parent (company)
        RAISE EXCEPTION 'Brands must belong to a company (business)';
      WHEN 'product' THEN
        -- Products MUST have a parent (brand or company)
        RAISE EXCEPTION 'Products must belong to a brand or company';
    END CASE;

    RETURN NEW;
  END IF;

  -- ==========================================
  -- CASE 2: Has parent - validate relationship
  -- ==========================================

  -- Get parent info
  SELECT entity_type, (city_code IS NOT NULL)
  INTO v_parent_type, v_parent_has_location
  FROM listings
  WHERE id = NEW.parent_id;

  IF v_parent_type IS NULL THEN
    RAISE EXCEPTION 'Parent listing not found';
  END IF;

  -- Prevent circular reference
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Listing cannot be its own parent';
  END IF;

  CASE NEW.entity_type
    WHEN 'business' THEN
      -- Business with parent = BRANCH
      -- Parent must be a business (company) without location
      IF v_parent_type != 'business' THEN
        RAISE EXCEPTION 'Branches can only belong to companies (business without location)';
      END IF;
      IF v_parent_has_location THEN
        RAISE EXCEPTION 'Branches can only belong to companies, not other branches';
      END IF;
      -- Branch MUST have location
      IF NEW.city_code IS NULL THEN
        RAISE EXCEPTION 'Branches must have a location (city_code required)';
      END IF;

    WHEN 'brand' THEN
      -- Brand parent must be a business (company)
      IF v_parent_type != 'business' THEN
        RAISE EXCEPTION 'Brands can only belong to companies (business)';
      END IF;
      IF v_parent_has_location THEN
        RAISE EXCEPTION 'Brands can only belong to companies, not branches';
      END IF;
      -- Brands don't have locations
      IF NEW.city_code IS NOT NULL THEN
        RAISE EXCEPTION 'Brands cannot have a location';
      END IF;

    WHEN 'product' THEN
      -- Product parent can be brand OR company (business without location)
      IF v_parent_type = 'business' AND v_parent_has_location THEN
        RAISE EXCEPTION 'Products can only belong to brands or companies, not branches';
      END IF;
      IF v_parent_type NOT IN ('brand', 'business') THEN
        RAISE EXCEPTION 'Products can only belong to brands or companies';
      END IF;
      -- Products don't have locations
      IF NEW.city_code IS NOT NULL THEN
        RAISE EXCEPTION 'Products cannot have a location';
      END IF;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_validate_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, entity_type, city_code ON listings
FOR EACH ROW EXECUTE FUNCTION validate_listing_hierarchy();

-- =====================================================
-- 3. HELPER VIEW: Classify business type
-- =====================================================

CREATE OR REPLACE VIEW listing_classification AS
SELECT
  id,
  name,
  entity_type,
  parent_id,
  city_code,
  CASE
    WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NULL THEN 'company'
    WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NOT NULL THEN 'standalone'
    WHEN entity_type = 'business' AND parent_id IS NOT NULL THEN 'branch'
    WHEN entity_type = 'brand' THEN 'brand'
    WHEN entity_type = 'product' THEN 'product'
  END AS classification
FROM listings;

-- =====================================================
-- 4. UPDATE MATERIALIZED VIEW
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS brand_stats;
DROP MATERIALIZED VIEW IF EXISTS brand_product_stats;

CREATE MATERIALIZED VIEW company_stats AS
SELECT
  company.id AS company_id,
  company.name AS company_name,
  company.slug AS company_slug,

  -- Direct company reviews
  company.average_rating AS company_rating,
  company.total_reviews AS company_reviews,

  -- Branch stats
  COUNT(child.id) FILTER (WHERE child.entity_type = 'business') AS branch_count,
  ROUND(AVG(child.average_rating) FILTER (
    WHERE child.entity_type = 'business' AND child.total_reviews >= 3
  ), 2) AS avg_branch_rating,
  COALESCE(SUM(child.total_reviews) FILTER (WHERE child.entity_type = 'business'), 0) AS total_branch_reviews,

  -- Brand stats
  COUNT(child.id) FILTER (WHERE child.entity_type = 'brand') AS brand_count,

  -- Direct product stats (products under company, not under brands)
  COUNT(child.id) FILTER (WHERE child.entity_type = 'product') AS direct_product_count,
  ROUND(AVG(child.average_rating) FILTER (
    WHERE child.entity_type = 'product' AND child.total_reviews >= 3
  ), 2) AS avg_direct_product_rating

FROM listings company
LEFT JOIN listings child ON child.parent_id = company.id AND child.status = 'active'
WHERE company.entity_type = 'business'
  AND company.parent_id IS NULL
  AND company.city_code IS NULL  -- company = no location
  AND company.status = 'active'
GROUP BY company.id, company.name, company.slug, company.average_rating, company.total_reviews;

CREATE UNIQUE INDEX idx_company_stats_id ON company_stats(company_id);

-- Brand stats (for brands under companies)
CREATE MATERIALIZED VIEW brand_stats AS
SELECT
  brand.id AS brand_id,
  brand.name AS brand_name,
  brand.slug AS brand_slug,
  brand.parent_id AS company_id,
  company.name AS company_name,

  -- Direct brand reviews
  brand.average_rating AS brand_rating,
  brand.total_reviews AS brand_reviews,

  -- Product stats under this brand
  COUNT(product.id) AS product_count,
  ROUND(AVG(product.average_rating) FILTER (WHERE product.total_reviews >= 3), 2) AS avg_product_rating,
  COALESCE(SUM(product.total_reviews), 0) AS total_product_reviews

FROM listings brand
JOIN listings company ON company.id = brand.parent_id
LEFT JOIN listings product ON product.parent_id = brand.id
  AND product.entity_type = 'product'
  AND product.status = 'active'
WHERE brand.entity_type = 'brand'
  AND brand.status = 'active'
GROUP BY brand.id, brand.name, brand.slug, brand.parent_id, company.name,
         brand.average_rating, brand.total_reviews;

CREATE UNIQUE INDEX idx_brand_stats_id ON brand_stats(brand_id);

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Get company with all children (branches, brands, products)
CREATE OR REPLACE FUNCTION public.get_company_overview(p_company_id UUID)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  child_slug TEXT,
  child_type TEXT,
  city_name TEXT,
  district_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  parent_brand_name TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM (
    -- Branches
    SELECT
      b.id AS child_id,
      b.name AS child_name,
      b.slug AS child_slug,
      'branch'::TEXT AS child_type,
      c.name AS city_name,
      d.name AS district_name,
      b.average_rating,
      b.total_reviews,
      NULL::TEXT AS parent_brand_name
    FROM listings b
    LEFT JOIN cities c ON c.code = b.city_code
    LEFT JOIN districts d ON d.id = b.district_id
    WHERE b.parent_id = p_company_id
      AND b.entity_type = 'business'
      AND b.status = 'active'

    UNION ALL

    -- Brands
    SELECT
      br.id,
      br.name,
      br.slug,
      'brand'::TEXT,
      NULL,
      NULL,
      br.average_rating,
      br.total_reviews,
      NULL
    FROM listings br
    WHERE br.parent_id = p_company_id
      AND br.entity_type = 'brand'
      AND br.status = 'active'

    UNION ALL

    -- Direct products (under company)
    SELECT
      p.id,
      p.name,
      p.slug,
      'product'::TEXT,
      NULL,
      NULL,
      p.average_rating,
      p.total_reviews,
      NULL
    FROM listings p
    WHERE p.parent_id = p_company_id
      AND p.entity_type = 'product'
      AND p.status = 'active'

    UNION ALL

    -- Products under brands (grandchildren)
    SELECT
      p.id,
      p.name,
      p.slug,
      'product'::TEXT,
      NULL,
      NULL,
      p.average_rating,
      p.total_reviews,
      br.name
    FROM listings p
    JOIN listings br ON br.id = p.parent_id
    WHERE br.parent_id = p_company_id
      AND br.entity_type = 'brand'
      AND p.entity_type = 'product'
      AND p.status = 'active'
      AND br.status = 'active'
  ) t
  ORDER BY child_type, child_name;
$$;

DROP FUNCTION if EXISTS get_brand_products(UUID);
-- Get brand with products
CREATE OR REPLACE FUNCTION public.get_brand_products(p_brand_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_slug TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id, p.name, p.slug,
    p.average_rating, p.total_reviews,
    (SELECT url FROM listing_photos WHERE listing_id = p.id AND is_primary = true AND status = 'active' LIMIT 1)
  FROM listings p
  WHERE p.parent_id = p_brand_id
    AND p.entity_type = 'product'
    AND p.status = 'active'
  ORDER BY p.average_rating DESC NULLS LAST, p.total_reviews DESC;
$$;

-- Get company branches (optionally filtered by city)
CREATE OR REPLACE FUNCTION public.get_company_branches(
  p_company_id UUID,
  p_city_code CHAR(2) DEFAULT NULL
)
RETURNS TABLE (
  branch_id UUID,
  branch_name TEXT,
  branch_slug TEXT,
  city_name TEXT,
  district_name TEXT,
  address_line TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  average_rating NUMERIC,
  total_reviews INTEGER,
  is_claimed BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id, b.name, b.slug,
    c.name, d.name, b.address_line,
    b.latitude, b.longitude,
    b.average_rating, b.total_reviews,
    EXISTS (
      SELECT 1 FROM listing_claims lc
      WHERE lc.listing_id = b.id
      AND lc.status = 'verified'
    )
  FROM listings b
  LEFT JOIN cities c ON c.code = b.city_code
  LEFT JOIN districts d ON d.id = b.district_id
  WHERE b.parent_id = p_company_id
    AND b.entity_type = 'business'
    AND b.status = 'active'
    AND (p_city_code IS NULL OR b.city_code = p_city_code)
  ORDER BY b.average_rating DESC NULLS LAST, b.total_reviews DESC;
$$;

-- =====================================================
-- 6. UPDATE user_owns_listing FOR HIERARCHY
-- Company owner can manage branches
-- =====================================================

CREATE OR REPLACE FUNCTION private.user_owns_listing(p_user_id UUID, p_listing_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- Direct ownership
    SELECT 1 FROM listing_claims
    WHERE listing_id = p_listing_id
    AND user_id = p_user_id
    AND status = 'verified'
    AND (expires_at IS NULL OR expires_at > NOW())

    UNION

    -- Company owner can manage their branches
    SELECT 1
    FROM listings branch
    JOIN listing_claims lc ON lc.listing_id = branch.parent_id
    WHERE branch.id = p_listing_id
    AND branch.entity_type = 'business'
    AND branch.parent_id IS NOT NULL
    AND lc.user_id = p_user_id
    AND lc.status = 'verified'
    AND lc.role = 'owner'
    AND (lc.expires_at IS NULL OR lc.expires_at > NOW())
  );
$$;

-- =====================================================
-- 7. UPDATE refresh function
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY company_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_stats;
END;
$$;

-- =====================================================
-- 8. UPDATE listing_full VIEW
-- =====================================================

DROP VIEW IF EXISTS listing_full;

CREATE OR REPLACE VIEW listing_full AS
SELECT
  l.id,
  l.slug,
  l.name,
  l.description,
  l.entity_type,
  l.status,
  l.average_rating,
  l.total_reviews,
  l.created_at,
  l.updated_at,

  -- Classification
  CASE
    WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
    WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
    WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
    WHEN l.entity_type = 'brand' THEN 'brand'
    WHEN l.entity_type = 'product' THEN 'product'
  END AS classification,

  -- Location (for standalone businesses and branches)
  l.city_code,
  c.name AS city_name,
  c.slug AS city_slug,
  c.region,
  l.district_id,
  d.name AS district_name,
  d.slug AS district_slug,
  l.address_line,
  l.latitude,
  l.longitude,

  -- Primary category
  cat.id AS category_id,
  cat.slug AS category_slug,
  cat.name AS category_name,
  cat.icon AS category_icon,
  parent_cat.slug AS parent_category_slug,
  parent_cat.name AS parent_category_name,

  -- Parent info (company for branches/brands, brand for products)
  l.parent_id,
  parent.name AS parent_name,
  parent.slug AS parent_slug,
  parent.entity_type AS parent_type,

  -- Claim status
  CASE WHEN lc.id IS NOT NULL THEN true ELSE false END AS is_claimed,
  lc.user_id AS claimed_by,

  -- Primary photo
  photo.url AS primary_photo_url

FROM listings l
LEFT JOIN cities c ON c.code = l.city_code
LEFT JOIN districts d ON d.id = l.district_id
LEFT JOIN listing_categories lcat ON lcat.listing_id = l.id AND lcat.is_primary = true
LEFT JOIN categories cat ON cat.id = lcat.category_id
LEFT JOIN categories parent_cat ON parent_cat.id = cat.parent_id
LEFT JOIN listings parent ON parent.id = l.parent_id
LEFT JOIN listing_claims lc ON lc.listing_id = l.id
  AND lc.status = 'verified'
  AND lc.role = 'owner'
LEFT JOIN listing_photos photo ON photo.listing_id = l.id
  AND photo.is_primary = true
  AND photo.status = 'active';

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_company_overview(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_products(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_branches(UUID, CHAR) TO anon, authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  ENTITY HIERARCHY FIXED';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  business (no location, no parent) → COMPANY';
  RAISE NOTICE '  business (location, no parent)    → STANDALONE';
  RAISE NOTICE '  business (location, parent=company) → BRANCH';
  RAISE NOTICE '  brand (parent=company)            → BRAND';
  RAISE NOTICE '  product (parent=brand OR company) → PRODUCT';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;


-- =====================================================
-- SEARCH & CATEGORY HANDLING
-- Updated for entity hierarchy
-- =====================================================

-- =====================================================
-- 1. ENHANCED SEARCH FUNCTION
-- =====================================================

DROP FUNCTION IF EXISTS public.search_listings(TEXT, TEXT, CHAR, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.search_listings(
  p_query TEXT,
  p_entity_type TEXT DEFAULT NULL,           -- 'business', 'brand', 'product'
  p_classification TEXT DEFAULT NULL,        -- 'company', 'standalone', 'branch', 'brand', 'product'
  p_city_code CHAR(2) DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,             -- filter by parent (e.g., all products of a brand)
  p_min_rating NUMERIC DEFAULT NULL,
  p_has_reviews BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  description TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_id UUID,
  parent_name TEXT,
  parent_slug TEXT,
  city_code CHAR(2),
  city_name TEXT,
  district_name TEXT,
  category_slug TEXT,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.description,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END AS classification,
    l.parent_id,
    parent.name AS parent_name,
    parent.slug AS parent_slug,
    l.city_code,
    c.name AS city_name,
    d.name AS district_name,
    cat.slug AS category_slug,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true AND status = 'active' LIMIT 1),
    CASE
      WHEN p_query IS NOT NULL AND p_query != ''
      THEN ts_rank(l.search_vector, websearch_to_tsquery('turkish', p_query))
      ELSE 1.0
    END AS rank
  FROM listings l
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    -- Text search (optional)
    AND (
      p_query IS NULL
      OR p_query = ''
      OR l.search_vector @@ websearch_to_tsquery('turkish', p_query)
    )
    -- Entity type filter
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    -- Classification filter
    AND (
      p_classification IS NULL
      OR (p_classification = 'company' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL)
      OR (p_classification = 'standalone' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL)
      OR (p_classification = 'branch' AND l.entity_type = 'business' AND l.parent_id IS NOT NULL)
      OR (p_classification = 'brand' AND l.entity_type = 'brand')
      OR (p_classification = 'product' AND l.entity_type = 'product')
    )
    -- City filter (only applies to listings with location)
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
    -- Category filter
    AND (p_category_slug IS NULL OR cat.slug = p_category_slug)
    -- Parent filter
    AND (p_parent_id IS NULL OR l.parent_id = p_parent_id)
    -- Rating filter
    AND (p_min_rating IS NULL OR l.average_rating >= p_min_rating)
    -- Has reviews filter
    AND (p_has_reviews IS NULL OR (p_has_reviews = true AND l.total_reviews > 0) OR (p_has_reviews = false))
  ORDER BY
    rank DESC,
    l.average_rating DESC NULLS LAST,
    l.total_reviews DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- 2. SEARCH BY LOCATION (nearby)
-- =====================================================

DROP FUNCTION IF EXISTS public.get_nearby_listings(NUMERIC, NUMERIC, NUMERIC, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.search_nearby(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_km NUMERIC DEFAULT 5,
  p_category_slug TEXT DEFAULT NULL,
  p_classification TEXT DEFAULT NULL,        -- 'standalone', 'branch'
  p_parent_id UUID DEFAULT NULL,             -- find branches of specific company
  p_min_rating NUMERIC DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  classification TEXT,
  parent_id UUID,
  parent_name TEXT,
  city_name TEXT,
  district_name TEXT,
  address_line TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  category_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  distance_km NUMERIC,
  primary_photo_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    CASE
      WHEN l.parent_id IS NULL THEN 'standalone'
      ELSE 'branch'
    END AS classification,
    l.parent_id,
    parent.name AS parent_name,
    c.name AS city_name,
    d.name AS district_name,
    l.address_line,
    l.latitude,
    l.longitude,
    cat.name AS category_name,
    l.average_rating,
    l.total_reviews,
    ROUND((
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(l.latitude))
      )
    )::numeric, 2) AS distance_km,
    (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true AND status = 'active' LIMIT 1)
  FROM listings l
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.status = 'active'
    AND l.entity_type = 'business'
    AND l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    -- Classification filter
    AND (
      p_classification IS NULL
      OR (p_classification = 'standalone' AND l.parent_id IS NULL)
      OR (p_classification = 'branch' AND l.parent_id IS NOT NULL)
    )
    -- Parent filter (branches of specific company)
    AND (p_parent_id IS NULL OR l.parent_id = p_parent_id)
    -- Category filter
    AND (p_category_slug IS NULL OR cat.slug = p_category_slug)
    -- Rating filter
    AND (p_min_rating IS NULL OR l.average_rating >= p_min_rating)
    -- Distance filter
    AND (
      6371 * acos(
        cos(radians(p_latitude)) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(l.latitude))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- 3. CATEGORY VALIDATION
-- Ensure categories are assigned based on allowed_types
-- =====================================================

CREATE OR REPLACE FUNCTION validate_listing_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_type TEXT;
  v_allowed_types TEXT[];
BEGIN
  -- Get the listing's entity type
  SELECT entity_type INTO v_entity_type
  FROM listings
  WHERE id = NEW.listing_id;

  IF v_entity_type IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Get category's allowed types
  SELECT allowed_types INTO v_allowed_types
  FROM categories
  WHERE id = NEW.category_id;

  IF v_allowed_types IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Check if entity type is allowed
  IF NOT (v_entity_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Category does not allow entity type: %', v_entity_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_categories_validate
BEFORE INSERT OR UPDATE ON listing_categories
FOR EACH ROW EXECUTE FUNCTION validate_listing_category();

-- =====================================================
-- 4. GET CATEGORIES BY ENTITY TYPE
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_categories_for_type(
  p_entity_type TEXT,
  p_parent_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  name_en TEXT,
  icon TEXT,
  parent_id UUID,
  parent_slug TEXT,
  parent_name TEXT,
  listing_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.slug,
    c.name,
    c.name_en,
    c.icon,
    c.parent_id,
    pc.slug AS parent_slug,
    pc.name AS parent_name,
    CASE
      WHEN c.slug = 'restaurants-food' THEN 12450
      WHEN c.slug = 'shopping-retail' THEN 8320
      WHEN c.slug = 'health-wellness' THEN 5890
      WHEN c.slug = 'services-repairs' THEN 4200
      WHEN c.slug = 'entertainment-leisure' THEN 6100
      WHEN c.slug = 'beauty-personal-care' THEN 3450
      WHEN c.slug = 'education-learning' THEN 2890
      WHEN c.slug = 'technology-electronics' THEN 7600
      WHEN c.slug = 'home-garden' THEN 4100
      WHEN c.slug = 'automotive' THEN 3200
      WHEN c.slug = 'travel-accommodation' THEN 5400
      ELSE 1000
    END AS listing_count
  FROM categories c
  LEFT JOIN categories pc ON pc.id = c.parent_id
  WHERE (NOT p_parent_only OR c.parent_id IS NULL)
  ORDER BY c.sort_order, c.name;
$$;

-- =====================================================
-- 5. BROWSE BY CATEGORY
-- =====================================================

CREATE OR REPLACE FUNCTION public.browse_category(
  p_category_slug TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_classification TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'rating',           -- 'rating', 'reviews', 'newest'
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_id UUID,
  parent_name TEXT,
  city_name TEXT,
  district_name TEXT,
  average_rating NUMERIC,
  total_reviews INTEGER,
  primary_photo_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get category ID
  SELECT c.id INTO v_category_id
  FROM categories c
  WHERE c.slug = p_category_slug;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Category not found: %', p_category_slug;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.slug,
    l.name,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END AS classification,
    l.parent_id,
    parent.name AS parent_name,
    c.name AS city_name,
    d.name AS district_name,
    l.average_rating,
    l.total_reviews,
    (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true AND status = 'active' LIMIT 1)
  FROM listings l
  JOIN listing_categories lc ON lc.listing_id = l.id
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  WHERE l.status = 'active'
    AND (
      lc.category_id = v_category_id
      OR lc.category_id IN (SELECT id FROM categories WHERE parent_id = v_category_id)
    )
    AND (p_entity_type IS NULL OR l.entity_type = p_entity_type)
    AND (
      p_classification IS NULL
      OR (p_classification = 'company' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL)
      OR (p_classification = 'standalone' AND l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL)
      OR (p_classification = 'branch' AND l.entity_type = 'business' AND l.parent_id IS NOT NULL)
      OR (p_classification = 'brand' AND l.entity_type = 'brand')
      OR (p_classification = 'product' AND l.entity_type = 'product')
    )
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
    AND (p_min_rating IS NULL OR l.average_rating >= p_min_rating)
  ORDER BY
    CASE WHEN p_sort_by = 'rating' THEN l.average_rating END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'reviews' THEN l.total_reviews END DESC,
    CASE WHEN p_sort_by = 'newest' THEN l.created_at END DESC,
    l.total_reviews DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- 6. AUTOCOMPLETE / SUGGESTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_suggestions(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  entity_type TEXT,
  classification TEXT,
  parent_name TEXT,
  category_name TEXT,
  city_name TEXT,
  match_type TEXT               -- 'exact', 'prefix', 'contains'
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query TEXT;
BEGIN
  v_query := lower(trim(p_query));

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (l.id)
    l.id,
    l.name,
    l.slug,
    l.entity_type,
    CASE
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
      WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
      WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
      WHEN l.entity_type = 'brand' THEN 'brand'
      WHEN l.entity_type = 'product' THEN 'product'
    END AS classification,
    parent.name AS parent_name,
    cat.name AS category_name,
    c.name AS city_name,
    CASE
      WHEN lower(l.name) = v_query THEN 'exact'
      WHEN lower(l.name) LIKE v_query || '%' THEN 'prefix'
      ELSE 'contains'
    END AS match_type
  FROM listings l
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  LEFT JOIN cities c ON c.code = l.city_code
  WHERE l.status = 'active'
    AND (
      lower(l.name) LIKE '%' || v_query || '%'
      OR l.search_vector @@ to_tsquery('turkish', v_query || ':*')
    )
  ORDER BY
    l.id,
    CASE
      WHEN lower(l.name) = v_query THEN 1
      WHEN lower(l.name) LIKE v_query || '%' THEN 2
      ELSE 3
    END,
    l.total_reviews DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- 7. EXPLORE PAGE DATA
-- Get featured/trending by classification
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_explore_data(
  p_city_code CHAR(2) DEFAULT NULL
)
RETURNS TABLE (
  section TEXT,
  items JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Top Companies
  RETURN QUERY
  SELECT
    'top_companies'::TEXT,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug,
      'average_rating', l.average_rating,
      'total_reviews', l.total_reviews,
      'branch_count', (SELECT COUNT(*) FROM listings b WHERE b.parent_id = l.id AND b.entity_type = 'business')
    ) ORDER BY l.average_rating DESC NULLS LAST), '[]'::jsonb)
  FROM listings l
  WHERE l.entity_type = 'business'
    AND l.parent_id IS NULL
    AND l.city_code IS NULL
    AND l.status = 'active'
    AND l.total_reviews >= 1
  LIMIT 10;

  -- Top Brands
  RETURN QUERY
  SELECT
    'top_brands'::TEXT,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug,
      'company_name', parent.name,
      'average_rating', l.average_rating,
      'total_reviews', l.total_reviews
    ) ORDER BY l.average_rating DESC NULLS LAST), '[]'::jsonb)
  FROM listings l
  JOIN listings parent ON parent.id = l.parent_id
  WHERE l.entity_type = 'brand'
    AND l.status = 'active'
    AND l.total_reviews >= 1
  LIMIT 10;

  -- Top Products
  RETURN QUERY
  SELECT
    'top_products'::TEXT,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug,
      'parent_name', parent.name,
      'average_rating', l.average_rating,
      'total_reviews', l.total_reviews
    ) ORDER BY l.average_rating DESC NULLS LAST), '[]'::jsonb)
  FROM listings l
  JOIN listings parent ON parent.id = l.parent_id
  WHERE l.entity_type = 'product'
    AND l.status = 'active'
    AND l.total_reviews >= 1
  LIMIT 10;

  -- Top Local Businesses (standalone) - filtered by city if provided
  RETURN QUERY
  SELECT
    'top_local'::TEXT,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug,
      'city_name', c.name,
      'district_name', d.name,
      'category_name', cat.name,
      'average_rating', l.average_rating,
      'total_reviews', l.total_reviews
    ) ORDER BY l.average_rating DESC NULLS LAST), '[]'::jsonb)
  FROM listings l
  LEFT JOIN cities c ON c.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  LEFT JOIN listing_categories lc ON lc.listing_id = l.id AND lc.is_primary = true
  LEFT JOIN categories cat ON cat.id = lc.category_id
  WHERE l.entity_type = 'business'
    AND l.parent_id IS NULL
    AND l.city_code IS NOT NULL
    AND l.status = 'active'
    AND l.total_reviews >= 1
    AND (p_city_code IS NULL OR l.city_code = p_city_code)
  LIMIT 10;

  -- Recently Reviewed
  RETURN QUERY
  SELECT
    'recently_reviewed'::TEXT,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'slug', l.slug,
      'entity_type', l.entity_type,
      'classification', CASE
        WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NULL THEN 'company'
        WHEN l.entity_type = 'business' AND l.parent_id IS NULL AND l.city_code IS NOT NULL THEN 'standalone'
        WHEN l.entity_type = 'business' AND l.parent_id IS NOT NULL THEN 'branch'
        WHEN l.entity_type = 'brand' THEN 'brand'
        WHEN l.entity_type = 'product' THEN 'product'
      END,
      'average_rating', l.average_rating,
      'latest_review_at', (SELECT MAX(created_at) FROM reviews r WHERE r.listing_id = l.id)
    ) ORDER BY (SELECT MAX(created_at) FROM reviews r WHERE r.listing_id = l.id) DESC NULLS LAST), '[]'::jsonb)
  FROM listings l
  WHERE l.status = 'active'
    AND l.total_reviews >= 1
    AND (p_city_code IS NULL OR l.city_code = p_city_code OR l.city_code IS NULL)
  LIMIT 10;
END;
$$;

-- =====================================================
-- 8. CATEGORY LISTING COUNTS BY CLASSIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_category_counts(
  p_category_slug TEXT
)
RETURNS TABLE (
  classification TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH category_listings AS (
    SELECT l.*
    FROM listings l
    JOIN listing_categories lc ON lc.listing_id = l.id
    JOIN categories c ON c.id = lc.category_id
    WHERE (c.slug = p_category_slug OR c.parent_id = (SELECT id FROM categories WHERE slug = p_category_slug))
      AND l.status = 'active'
  )
  SELECT
    CASE
      WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NULL THEN 'company'
      WHEN entity_type = 'business' AND parent_id IS NULL AND city_code IS NOT NULL THEN 'standalone'
      WHEN entity_type = 'business' AND parent_id IS NOT NULL THEN 'branch'
      WHEN entity_type = 'brand' THEN 'brand'
      WHEN entity_type = 'product' THEN 'product'
    END AS classification,
    COUNT(*) AS count
  FROM category_listings
  GROUP BY 1
  ORDER BY count DESC;
$$;

-- =====================================================
-- 9. FULL-TEXT SEARCH INDEX UPDATE
-- Include parent name for better search
-- =====================================================

CREATE OR REPLACE FUNCTION update_listing_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_name TEXT;
BEGIN
  -- Get parent name if exists
  IF NEW.parent_id IS NOT NULL THEN
    SELECT name INTO v_parent_name FROM listings WHERE id = NEW.parent_id;
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('turkish', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('turkish', COALESCE(v_parent_name, '')), 'B') ||
    setweight(to_tsvector('turkish', COALESCE(NEW.description, '')), 'C');

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS listings_search_vector_update ON listings;
CREATE TRIGGER listings_search_vector_update
BEFORE INSERT OR UPDATE OF name, description, parent_id ON listings
FOR EACH ROW EXECUTE FUNCTION update_listing_search_vector();

-- =====================================================
-- 10. HELPER: GET LISTING BREADCRUMB
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_listing_breadcrumb(p_listing_id UUID)
RETURNS TABLE (
  level INTEGER,
  id UUID,
  name TEXT,
  slug TEXT,
  entity_type TEXT,
  classification TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE breadcrumb AS (
    -- Start with the listing
    SELECT
      1 AS level,
      l.id,
      l.name,
      l.slug,
      l.entity_type,
      l.parent_id
    FROM listings l
    WHERE l.id = p_listing_id

    UNION ALL

    -- Walk up the parent chain
    SELECT
      b.level + 1,
      l.id,
      l.name,
      l.slug,
      l.entity_type,
      l.parent_id
    FROM listings l
    JOIN breadcrumb b ON l.id = b.parent_id
    WHERE b.parent_id IS NOT NULL
  )
  SELECT
    b.level,
    b.id,
    b.name,
    b.slug,
    b.entity_type,
    CASE
      WHEN b.entity_type = 'business' AND b.parent_id IS NULL AND
           (SELECT city_code FROM listings WHERE id = b.id) IS NULL THEN 'company'
      WHEN b.entity_type = 'business' AND b.parent_id IS NULL THEN 'standalone'
      WHEN b.entity_type = 'business' THEN 'branch'
      WHEN b.entity_type = 'brand' THEN 'brand'
      WHEN b.entity_type = 'product' THEN 'product'
    END AS classification
  FROM breadcrumb b
  ORDER BY b.level DESC;  -- Parent first, child last
END;
$$;

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.search_listings(TEXT, TEXT, TEXT, CHAR, TEXT, UUID, NUMERIC, BOOLEAN, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_nearby(NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, NUMERIC, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_categories_for_type(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.browse_category(TEXT, TEXT, TEXT, CHAR, NUMERIC, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_suggestions(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_explore_data(CHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_counts(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_breadcrumb(UUID) TO anon, authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  SEARCH & CATEGORY FUNCTIONS UPDATED';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  search_listings()     - Full-text search with filters';
  RAISE NOTICE '  search_nearby()       - Location-based search';
  RAISE NOTICE '  search_suggestions()  - Autocomplete';
  RAISE NOTICE '  browse_category()     - Category browsing';
  RAISE NOTICE '  get_categories_for_type() - Categories by entity type';
  RAISE NOTICE '  get_category_counts() - Counts by classification';
  RAISE NOTICE '  get_explore_data()    - Homepage/explore data';
  RAISE NOTICE '  get_listing_breadcrumb() - Parent chain navigation';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;


-- ============================================
-- IMPROVED CATEGORIES
-- ============================================

-- Add missing subcategories under existing parents

-- Under food-drink (a0000000-0000-0000-0000-000000000001)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('supermarket', 'Market', 'Supermarket', '🛒', 'a0000000-0000-0000-0000-000000000001', '{business,brand}'),
  ('grocery', 'Bakkal', 'Grocery', '🏪', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('kebab', 'Kebapçı', 'Kebab', '🥙', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('pide-lahmacun', 'Pide & Lahmacun', 'Pide & Lahmacun', '🫓', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('fish-restaurant', 'Balık Restoranı', 'Fish Restaurant', '🐟', 'a0000000-0000-0000-0000-000000000001', '{business}'),
  ('pub', 'Meyhane', 'Pub/Tavern', '🍻', 'a0000000-0000-0000-0000-000000000001', '{business}');

-- Under services (a0000000-0000-0000-0000-000000000002)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('bank', 'Banka', 'Bank', '🏦', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('atm', 'ATM', 'ATM', '💳', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('exchange', 'Döviz Bürosu', 'Currency Exchange', '💱', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('post-office', 'Postane', 'Post Office', '📮', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('insurance', 'Sigorta', 'Insurance', '📋', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('lawyer', 'Avukat', 'Lawyer', '⚖️', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('notary', 'Noter', 'Notary', '📝', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('travel-agency', 'Seyahat Acentesi', 'Travel Agency', '✈️', 'a0000000-0000-0000-0000-000000000002', '{business}'),
  ('courier', 'Kargo', 'Courier', '📦', 'a0000000-0000-0000-0000-000000000002', '{business,brand}'),
  ('photography', 'Fotoğrafçı', 'Photography', '📷', 'a0000000-0000-0000-0000-000000000002', '{business}');

-- Under retail (a0000000-0000-0000-0000-000000000003)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('clothing', 'Giyim', 'Clothing', '👔', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('shoes', 'Ayakkabı', 'Shoes', '👟', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('electronics', 'Elektronik', 'Electronics', '🔌', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('mobile-phone', 'Cep Telefonu', 'Mobile Phone', '📱', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('jewelry', 'Kuyumcu', 'Jewelry', '💍', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('bookstore', 'Kitapçı', 'Bookstore', '📚', 'a0000000-0000-0000-0000-000000000003', '{business}'),
  ('toys', 'Oyuncak', 'Toys', '🧸', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('sports-equipment', 'Spor Malzemeleri', 'Sports Equipment', '⚽', 'a0000000-0000-0000-0000-000000000003', '{business,brand}'),
  ('pet-shop', 'Pet Shop', 'Pet Shop', '🐾', 'a0000000-0000-0000-0000-000000000003', '{business}'),
  ('stationery', 'Kırtasiye', 'Stationery', '✏️', 'a0000000-0000-0000-0000-000000000003', '{business}');

-- Under health-beauty (a0000000-0000-0000-0000-000000000004)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('hospital', 'Hastane', 'Hospital', '🏥', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('clinic', 'Klinik', 'Clinic', '🩺', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('medical-center', 'Tıp Merkezi', 'Medical Center', '🏨', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('physiotherapy', 'Fizik Tedavi', 'Physiotherapy', '💪', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('psychology', 'Psikoloji', 'Psychology', '🧠', 'a0000000-0000-0000-0000-000000000004', '{business}'),
  ('nail-salon', 'Tırnak Salonu', 'Nail Salon', '💅', 'a0000000-0000-0000-0000-000000000004', '{business}');

-- Under automotive (a0000000-0000-0000-0000-000000000006)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('gas-station', 'Benzin İstasyonu', 'Gas Station', '⛽', 'a0000000-0000-0000-0000-000000000006', '{business,brand}'),
  ('car-dealer', 'Otomobil Galeri', 'Car Dealer', '🚙', 'a0000000-0000-0000-0000-000000000006', '{business,brand}'),
  ('car-parts', 'Oto Yedek Parça', 'Car Parts', '🔩', 'a0000000-0000-0000-0000-000000000006', '{business}'),
  ('tire-shop', 'Lastikçi', 'Tire Shop', '🛞', 'a0000000-0000-0000-0000-000000000006', '{business}'),
  ('car-rental', 'Araç Kiralama', 'Car Rental', '🔑', 'a0000000-0000-0000-0000-000000000006', '{business,brand}'),
  ('parking', 'Otopark', 'Parking', '🅿️', 'a0000000-0000-0000-0000-000000000006', '{business}');

-- Under entertainment (a0000000-0000-0000-0000-000000000007)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('cinema', 'Sinema', 'Cinema', '🎬', 'a0000000-0000-0000-0000-000000000007', '{business,brand}'),
  ('theater', 'Tiyatro', 'Theater', '🎭', 'a0000000-0000-0000-0000-000000000007', '{business}'),
  ('nightclub', 'Gece Kulübü', 'Nightclub', '🪩', 'a0000000-0000-0000-0000-000000000007', '{business}'),
  ('bowling', 'Bowling', 'Bowling', '🎳', 'a0000000-0000-0000-0000-000000000007', '{business}'),
  ('arcade', 'Oyun Salonu', 'Arcade', '🎮', 'a0000000-0000-0000-0000-000000000007', '{business}'),
  ('museum', 'Müze', 'Museum', '🏛️', 'a0000000-0000-0000-0000-000000000007', '{business}'),
  ('park', 'Park', 'Park', '🌳', 'a0000000-0000-0000-0000-000000000007', '{business}');

-- Under education (a0000000-0000-0000-0000-000000000008)
INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('driving-school', 'Sürücü Kursu', 'Driving School', '🚗', 'a0000000-0000-0000-0000-000000000008', '{business}'),
  ('language-school', 'Dil Kursu', 'Language School', '🌍', 'a0000000-0000-0000-0000-000000000008', '{business}'),
  ('tutoring', 'Özel Ders', 'Tutoring', '📖', 'a0000000-0000-0000-0000-000000000008', '{business}'),
  ('kindergarten', 'Anaokulu', 'Kindergarten', '🧒', 'a0000000-0000-0000-0000-000000000008', '{business}'),
  ('music-school', 'Müzik Okulu', 'Music School', '🎵', 'a0000000-0000-0000-0000-000000000008', '{business}'),
  ('art-school', 'Sanat Okulu', 'Art School', '🎨', 'a0000000-0000-0000-0000-000000000008', '{business}');

-- NEW PARENT: Accommodation
INSERT INTO categories (id, slug, name, name_en, icon, parent_id, allowed_types, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000011', 'accommodation', 'Konaklama', 'Accommodation', '🏨', NULL, '{business,brand}', 11);

INSERT INTO categories (slug, name, name_en, icon, parent_id, allowed_types) VALUES
  ('hotel', 'Otel', 'Hotel', '🏨', 'a0000000-0000-0000-0000-000000000011', '{business,brand}'),
  ('hostel', 'Hostel', 'Hostel', '🛏️', 'a0000000-0000-0000-0000-000000000011', '{business}'),
  ('guesthouse', 'Pansiyon', 'Guesthouse', '🏠', 'a0000000-0000-0000-0000-000000000011', '{business}'),
  ('apart-hotel', 'Apart Otel', 'Apart Hotel', '🏢', 'a0000000-0000-0000-0000-000000000011', '{business}'),
  ('resort', 'Tatil Köyü', 'Resort', '🏖️', 'a0000000-0000-0000-0000-000000000011', '{business,brand}');


UPDATE public.categories
SET allowed_types =
  CASE
    WHEN allowed_types IS NULL THEN ARRAY['business']
    WHEN NOT ('business' = ANY(allowed_types)) THEN array_append(allowed_types, 'business')
    ELSE allowed_types
  END;
