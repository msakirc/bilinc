import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { AWS_REGION, SEARCH_URL } from '../aws/config';
import { cognitoUnauthCredentials } from '../aws/credentials';

// Browser port of mobile/src/services/search.ts. Calls the bilinc-search-proxy
// Lambda Function URL (AuthType=AWS_IAM), SigV4-signed with the same Cognito
// unauthenticated credentials used for the DynamoDB catalog. The proxy
// whitelists a small set of query shapes; no SQL and no DB token live in the
// bundle.
//
// Unlike the RN version, the browser has native `URL` and Web Crypto, so we use
// `new URL()` for parsing instead of a hand-rolled regex.

// ─── RAW proxy shapes (camelCase — returned as-is, NOT mapped) ──────

export interface SearchResult {
  id: string;
  name: string;
  entityType: string;
  cityCode?: string;
  categorySlug?: string;
  rating: number;
  totalReviews: number;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}

export interface SearchSuggestion {
  id: string;
  name: string;
  entityType: string;
  categorySlug?: string;
}

export interface NearbyResult extends SearchResult {
  distanceKm?: number;
}

// ─── Signed proxy client ───────────────────────────────────────────

const signer = new SignatureV4({
  service: 'lambda',
  region: AWS_REGION,
  credentials: cognitoUnauthCredentials,
  sha256: Sha256,
});

/**
 * POST a whitelisted op to the search proxy with a SigV4-signed request.
 * Returns the `results` array the Lambda already shaped for us (RAW).
 */
async function callProxy(payload: Record<string, unknown>): Promise<unknown[]> {
  if (!SEARCH_URL) return [];

  const url = new URL(SEARCH_URL);
  const body = JSON.stringify(payload);

  const signed = await signer.sign({
    method: 'POST',
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname || '/',
    headers: { host: url.hostname, 'content-type': 'application/json' },
    body,
  });

  let resp: Response;
  try {
    resp = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: signed.headers,
      body,
    });
  } catch (err) {
    console.error('[search] Network failure:', err);
    return [];
  }
  if (!resp.ok) {
    console.error(`[search] HTTP error: ${resp.status} ${resp.statusText}`);
    return [];
  }
  const data = await resp.json();
  return data.results ?? [];
}

// ─── Search Queries ────────────────────────────────────────────────

/**
 * Full-text search with optional filters (FTS5, server-side).
 */
export async function searchListings(
  query: string,
  options: {
    cityCode?: string;
    entityType?: string;
    categorySlug?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<SearchResult[]> {
  const { cityCode, entityType, categorySlug, limit = 20, offset = 0 } = options;
  return (await callProxy({
    op: 'search',
    q: query,
    cityCode,
    entityType,
    categorySlug,
    limit,
    offset,
  })) as SearchResult[];
}

/**
 * Location-based browse via the search proxy. The catalog lives in DynamoDB
 * (no geo index), so "nearby" runs against the search index's lat/lng with a
 * server-side bounding box + haversine refine. Returns results ordered by
 * ascending distance, each with `distanceKm`.
 */
export async function searchNearby(
  latitude: number,
  longitude: number,
  options: {
    radiusKm?: number;
    categorySlug?: string;
    entityType?: string;
    limit?: number;
  } = {},
): Promise<NearbyResult[]> {
  const { radiusKm = 5, categorySlug, entityType, limit = 20 } = options;
  return (await callProxy({
    op: 'nearby',
    lat: latitude,
    lng: longitude,
    radiusKm,
    categorySlug,
    entityType,
    limit,
  })) as NearbyResult[];
}

/**
 * Autocomplete / prefix search for suggestions (FTS5 prefix, server-side).
 */
export async function searchSuggestions(
  query: string,
  limit = 10,
): Promise<SearchSuggestion[]> {
  return (await callProxy({
    op: 'suggest',
    q: query,
    limit,
  })) as SearchSuggestion[];
}
