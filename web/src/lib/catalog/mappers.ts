// Pure mappers from the new catalog/search RAW camelCase shapes (DynamoDB +
// search proxy) to web's snake_case domain types (`../types`). These are the
// only place the new data layer's shapes cross into web's existing types, so
// screens/components keep reading the same fields they always have.

import type { EntityType, Listing, SearchResult, SearchSuggestion } from '../types';
import type { CatalogListing, CatalogListingCard } from './dynamodb';
import type {
  SearchResult as ProxySearchResult,
  SearchSuggestion as ProxySearchSuggestion,
} from '../search/proxy';

function primaryPhotoUrl(
  photos?: Array<{ url: string; primary?: boolean }>,
): string | undefined {
  if (!photos || photos.length === 0) return undefined;
  return photos.find((p) => p.primary)?.url ?? photos[0]?.url;
}

/**
 * Search proxy result → web SearchResult. The proxy has no slug/classification
 * and no joined display names, so those stay undefined.
 */
export function searchResultFromProxy(r: ProxySearchResult): SearchResult {
  return {
    id: r.id,
    name: r.name,
    slug: undefined as unknown as string,
    entity_type: r.entityType as EntityType,
    classification: undefined,
    city_code: r.cityCode,
    city_name: undefined,
    district_name: undefined,
    category_slug: r.categorySlug,
    category_name: undefined,
    parent_id: undefined,
    parent_name: undefined,
    parent_slug: undefined,
    average_rating: r.rating,
    total_reviews: r.totalReviews,
    primary_photo_url: r.photoUrl,
    latitude: r.latitude,
    longitude: r.longitude,
  } as SearchResult;
}

/**
 * Catalog card → web SearchResult (browse / trending / recent lists).
 * Cards carry no city_name/category_name, so those stay undefined.
 */
export function searchResultFromCard(c: CatalogListingCard): SearchResult {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    entity_type: c.entityType as EntityType,
    city_code: c.cityCode,
    average_rating: c.rating,
    total_reviews: c.totalReviews,
    primary_photo_url: primaryPhotoUrl(c.photos),
  } as SearchResult;
}

/**
 * Catalog card → web Listing. Used where a list endpoint must return Listings
 * (trending / recently added). Joined display fields and user/claim fields are
 * not in the card, so they default.
 */
export function listingFromCard(c: CatalogListingCard): Listing {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    entity_type: c.entityType as EntityType,
    status: 'active',
    city_code: c.cityCode,
    average_rating: c.rating,
    total_reviews: c.totalReviews,
    created_by: '',
    created_at: '',
    updated_at: '',
    primary_photo_url: primaryPhotoUrl(c.photos),
  } as Listing;
}

/**
 * Full catalog listing → web Listing (detail page). Maps every overlapping
 * field. Joined display fields (city_name, district_name, category_name,
 * parent_name) and user/claim fields are not in the catalog, so they default.
 */
export function listingFromCatalog(l: CatalogListing): Listing {
  return {
    id: l.id,
    slug: l.slug,
    name: l.name,
    description: l.description,
    entity_type: l.entityType as EntityType,
    status: l.status as Listing['status'],
    parent_id: l.parentId,
    city_code: l.cityCode,
    district_id: l.districtId,
    address_line: l.addressLine,
    latitude: l.latitude,
    longitude: l.longitude,
    average_rating: l.rating,
    total_reviews: l.totalReviews,
    created_by: '',
    created_at: l.createdAt,
    updated_at: l.updatedAt ?? '',
    category_slug:
      l.categories?.find((c) => c.primary)?.slug ?? l.categories?.[0]?.slug,
    primary_photo_url: primaryPhotoUrl(l.photos),
  } as Listing;
}

/**
 * Search proxy suggestion → web SearchSuggestion. The proxy only carries
 * id/name/entityType/categorySlug; web's SearchSuggestion has no categorySlug
 * field, so it is dropped. match_type is fixed to "name".
 */
export function suggestionFromProxy(s: ProxySearchSuggestion): SearchSuggestion {
  return {
    id: s.id,
    name: s.name,
    slug: undefined as unknown as string,
    entity_type: s.entityType as EntityType,
    match_type: 'name',
  } as SearchSuggestion;
}
