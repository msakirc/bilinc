/**
 * Service unit tests for src/services/search.ts
 * Covers: searchListings, searchSuggestions, searchNearby.
 *
 * The app no longer talks to Turso directly. search.ts POSTs {op, ...params}
 * to the bilinc-search-proxy Lambda Function URL (AuthType=AWS_IAM), SigV4-signed
 * with the same Cognito unauth creds used for DynamoDB. The Lambda shapes the
 * rows, so this layer just forwards params and passes the `results` array back.
 *
 * Assertions:
 *   (a) fetch hits SEARCH_URL with a POST whose JSON body has the right {op, ...}
 *   (b) the parsed `results` array is returned verbatim (no client-side transform)
 *   (c) edge cases: empty results, non-ok HTTP, network failure
 *
 * Module deps are mocked so no Cognito / signing / network happens:
 *   - config/aws: pin SEARCH_URL to a test URL
 *   - @aws-sdk/credential-providers: dummy credential resolver
 *   - @smithy/signature-v4: pass-through signer (echoes headers)
 */

jest.mock('../../config/aws', () => ({
  AWS_REGION: 'eu-central-1',
  COGNITO_IDENTITY_POOL_ID: 'eu-central-1:test-pool',
  DYNAMODB_TABLE: 'bilinc-catalog',
  SEARCH_URL: 'https://test-proxy.lambda-url.eu-central-1.on.aws/',
}));

jest.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: () => async () => ({
    accessKeyId: 'AKIA_TEST',
    secretAccessKey: 'secret',
    sessionToken: 'token',
  }),
}));

jest.mock('@aws-crypto/sha256-js', () => ({ Sha256: class {} }));

jest.mock('@smithy/signature-v4', () => ({
  SignatureV4: class {
    // Echo the request, adding a fake auth header — enough for the client to
    // forward `headers` to fetch.
    async sign(req: any) {
      return { ...req, headers: { ...req.headers, authorization: 'AWS4-HMAC-SHA256 test' } };
    }
  },
}));

import { searchListings, searchSuggestions, searchNearby } from '../search';

const SEARCH_URL = 'https://test-proxy.lambda-url.eu-central-1.on.aws/';

function mockFetch(responseBody: object, ok = true) {
  const mock = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: jest.fn().mockResolvedValue(responseBody),
  });
  global.fetch = mock as any;
  return mock;
}

/** Parse the JSON body of the first fetch call. */
function firstBody(fetchMock: jest.Mock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

// ---------------------------------------------------------------------------
// searchListings
// ---------------------------------------------------------------------------

describe('search.searchListings', () => {
  it('POSTs {op:"search", q} to the proxy URL', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchListings('lokanta');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SEARCH_URL);
    expect(init.method).toBe('POST');
    const body = firstBody(fetchMock);
    expect(body.op).toBe('search');
    expect(body.q).toBe('lokanta');
    expect(body.limit).toBe(20); // default
    expect(body.offset).toBe(0); // default
  });

  it('forwards cityCode / entityType / categorySlug / limit / offset filters', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchListings('kafe', {
      cityCode: '34',
      entityType: 'business',
      categorySlug: 'cafe',
      limit: 5,
      offset: 10,
    });

    expect(firstBody(fetchMock)).toMatchObject({
      op: 'search',
      q: 'kafe',
      cityCode: '34',
      entityType: 'business',
      categorySlug: 'cafe',
      limit: 5,
      offset: 10,
    });
  });

  it('returns the proxy results array verbatim (Lambda already shaped them)', async () => {
    const rows = [
      {
        id: 'biz-1',
        name: 'Ortaklar Lokantası',
        entityType: 'business',
        cityCode: '34',
        categorySlug: 'restaurant',
        rating: 4.5,
        totalReviews: 12,
        latitude: 41.01,
        longitude: 28.97,
        photoUrl: 'http://cdn/biz1.jpg',
      },
    ];
    mockFetch({ results: rows });

    const results = await searchListings('lokanta');

    expect(results).toEqual(rows);
  });

  it('returns [] when the proxy returns no results key', async () => {
    mockFetch({});

    const results = await searchListings('zzznomatch');

    expect(results).toEqual([]);
  });

  it('returns [] on a non-ok HTTP response from the proxy (graceful degradation)', async () => {
    mockFetch({}, false);

    const results = await searchListings('kafe');
    expect(results).toEqual([]);
  });

  it('returns [] on a network failure (graceful degradation)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any;

    const results = await searchListings('kafe');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// searchSuggestions
// ---------------------------------------------------------------------------

describe('search.searchSuggestions', () => {
  it('POSTs {op:"suggest", q, limit} with default limit 10', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchSuggestions('kaf');

    expect(firstBody(fetchMock)).toMatchObject({ op: 'suggest', q: 'kaf', limit: 10 });
  });

  it('forwards an explicit limit', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchSuggestions('kaf', 5);

    expect(firstBody(fetchMock).limit).toBe(5);
  });

  it('returns the proxy results array verbatim', async () => {
    const rows = [
      { id: 'biz-1', name: 'Kafe Nora', entityType: 'business', categorySlug: 'cafe' },
      { id: 'biz-2', name: 'Kafeterya Yıldız', entityType: 'business', categorySlug: 'cafeteria' },
    ];
    mockFetch({ results: rows });

    const results = await searchSuggestions('kaf');

    expect(results).toEqual(rows);
  });

  it('returns [] on a non-ok HTTP response (graceful degradation)', async () => {
    mockFetch({}, false);

    const results = await searchSuggestions('kaf');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// searchNearby
// ---------------------------------------------------------------------------

describe('search.searchNearby', () => {
  it('POSTs {op:"nearby", lat, lng} with default radius/limit', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchNearby(41.01, 28.97);

    expect(firstBody(fetchMock)).toMatchObject({
      op: 'nearby',
      lat: 41.01,
      lng: 28.97,
      radiusKm: 5,
      limit: 20,
    });
  });

  it('forwards radiusKm / categorySlug / entityType / limit', async () => {
    const fetchMock = mockFetch({ results: [] });

    await searchNearby(40.0, 29.0, {
      radiusKm: 10,
      categorySlug: 'cafe',
      entityType: 'business',
      limit: 5,
    });

    expect(firstBody(fetchMock)).toMatchObject({
      op: 'nearby',
      lat: 40.0,
      lng: 29.0,
      radiusKm: 10,
      categorySlug: 'cafe',
      entityType: 'business',
      limit: 5,
    });
  });

  it('returns the proxy results array verbatim (with distanceKm)', async () => {
    const rows = [
      {
        id: 'biz-1',
        name: 'Yakın Kafe',
        entityType: 'business',
        cityCode: '34',
        categorySlug: 'cafe',
        rating: 4.3,
        totalReviews: 9,
        latitude: 41.02,
        longitude: 28.98,
        photoUrl: 'http://cdn/y.jpg',
        distanceKm: 0.3,
      },
    ];
    mockFetch({ results: rows });

    const results = await searchNearby(41.01, 28.97);

    expect(results).toEqual(rows);
  });

  it('returns [] on a non-ok HTTP response (graceful degradation)', async () => {
    mockFetch({}, false);

    const results = await searchNearby(41.01, 28.97);
    expect(results).toEqual([]);
  });
});
