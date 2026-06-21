import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { AWS_REGION, COGNITO_IDENTITY_POOL_ID, SEARCH_URL } from '../config/aws';

// The app no longer talks to Turso directly. It calls the bilinc-search-proxy
// Lambda Function URL (AuthType=AWS_IAM), signed with the same Cognito
// unauthenticated credentials already used for the DynamoDB catalog. The proxy
// whitelists exactly two query shapes; no SQL and no DB token live in the bundle.

// ─── Types ─────────────────────────────────────────────────────────

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

// Hand-rolled Cognito UNAUTH credentials via plain fetch. The @aws-sdk
// credential providers / clients crash on RN release builds with
// "Symbol(node-only) is not a function" (they load their node runtimeConfig).
// GetId + GetCredentialsForIdentity are unsigned JSON POSTs, so fetch is enough.
let _credsCache: { value: any; expiresAt: number } | null = null;

export async function cognitoUnauthCredentials() {
  if (_credsCache && _credsCache.expiresAt - 60_000 > Date.now()) {
    return _credsCache.value;
  }
  const endpoint = `https://cognito-identity.${AWS_REGION}.amazonaws.com/`;
  const post = async (target: string, body: object) => {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': `AWSCognitoIdentityService.${target}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Cognito ${target} ${r.status}: ${await r.text()}`);
    return r.json();
  };
  const { IdentityId } = await post('GetId', { IdentityPoolId: COGNITO_IDENTITY_POOL_ID });
  const { Credentials } = await post('GetCredentialsForIdentity', { IdentityId });
  const value = {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
  };
  const expMs = Credentials.Expiration ? Number(Credentials.Expiration) * 1000 : Date.now() + 3_000_000;
  _credsCache = { value, expiresAt: expMs };
  return value;
}

const signer = new SignatureV4({
  service: 'lambda',
  region: AWS_REGION,
  credentials: cognitoUnauthCredentials,
  sha256: Sha256,
});

/**
 * POST a whitelisted op to the search proxy with a SigV4-signed request.
 * Returns the `results` array the Lambda already shaped for us.
 */
async function callProxy(payload: Record<string, any>): Promise<any[]> {
  if (!SEARCH_URL) return [];
  // Parse without `new URL` — RN has no URL polyfill installed.
  const m = SEARCH_URL.match(/^(https?):\/\/([^/]+)(\/[^?#]*)?/i);
  if (!m) return [];
  const protocol = `${m[1]}:`;
  const hostname = m[2];
  const path = m[3] || '/';
  const body = JSON.stringify(payload);

  const signed = await signer.sign({
    method: 'POST',
    protocol,
    hostname,
    path,
    headers: { host: hostname, 'content-type': 'application/json' },
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
 * (no geo index), so "nearby" runs against the Turso index's lat/lng with a
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
