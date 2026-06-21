-- FIX: browse_category missing category_slug and category_name columns
-- Date: 2026-04-05
-- Status: DEPLOYED to Supabase on 2026-04-05
-- Issue: Both mobile and web apps expect category_slug/category_name in SearchResult
--        but browse_category() didn't return them (search_listings() did).

-- Must DROP first because return type changed (added category_slug, category_name)
DROP FUNCTION IF EXISTS public.browse_category(text,text,text,character,numeric,text,integer,integer);

CREATE OR REPLACE FUNCTION public.browse_category(
  p_category_slug TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_classification TEXT DEFAULT NULL,
  p_city_code CHAR(2) DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'rating',
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
  category_slug TEXT,
  category_name TEXT,
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
  SELECT cat.id INTO v_category_id
  FROM categories cat
  WHERE cat.slug = p_category_slug;

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
    ci.name AS city_name,
    d.name AS district_name,
    cat_match.slug AS category_slug,
    cat_match.name AS category_name,
    l.average_rating,
    l.total_reviews,
    (SELECT lp.url FROM listing_photos lp WHERE lp.listing_id = l.id AND lp.is_primary = true AND lp.status = 'active' LIMIT 1)
  FROM listings l
  JOIN listing_categories lc ON lc.listing_id = l.id
  LEFT JOIN categories cat_match ON cat_match.id = lc.category_id
  LEFT JOIN listings parent ON parent.id = l.parent_id
  LEFT JOIN cities ci ON ci.code = l.city_code
  LEFT JOIN districts d ON d.id = l.district_id
  WHERE l.status = 'active'
    AND (
      lc.category_id = v_category_id
      OR lc.category_id IN (SELECT cat_sub.id FROM categories cat_sub WHERE cat_sub.parent_id = v_category_id)
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
