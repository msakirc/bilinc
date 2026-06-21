/**
 * Service unit tests for DatabaseService — listing claim methods.
 * Covers: createClaim, uploadVerificationVideo.
 *
 * Mock pattern is identical to database.facts.test.ts.
 */

import { makeSupabaseMock } from '../../../test/mocks/supabase';

const mockContainer = { client: null as any };

jest.mock('../supabase', () => ({
  supabase: new Proxy({}, {
    get(_target, prop) {
      return (mockContainer.client as any)[prop];
    },
  }),
}));

jest.mock('../dynamodb', () => ({
  getListing: jest.fn(),
  browseByCategory: jest.fn(),
  browseByCityCategory: jest.fn(),
  getRecentByType: jest.fn(),
  getBrandProducts: jest.fn(),
}));

jest.mock('../search', () => ({
  searchListings: jest.fn(),
  searchSuggestions: jest.fn(),
}));

import { DatabaseService } from '../database';

function setupMock(result: { data?: any; error?: any }) {
  const mock = makeSupabaseMock(result);
  mockContainer.client = mock.client;
  return mock;
}

// ---------------------------------------------------------------------------
// createClaim
// ---------------------------------------------------------------------------

describe('DatabaseService.createClaim', () => {
  const baseParams = {
    listingId: 'listing-abc',
    userId: 'user-xyz',
    role: 'owner' as const,
    verificationMethod: 'video' as const,
    taxNumber: '7460284301',
    consentAt: '2026-06-19T10:00:00.000Z',
  };

  it('inserts into "listing_claims" table', async () => {
    const { client } = setupMock({
      data: { id: 'claim-1' },
      error: null,
    });

    await DatabaseService.createClaim(baseParams);

    expect(client.from).toHaveBeenCalledWith('listing_claims');
  });

  it('inserts verification_method: "video"', async () => {
    const { calls } = setupMock({ data: { id: 'claim-2' }, error: null });

    await DatabaseService.createClaim(baseParams);

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall).toBeDefined();
    expect(insertCall![1][0]).toMatchObject({
      verification_method: 'video',
    });
  });

  it('always inserts status: "pending"', async () => {
    const { calls } = setupMock({ data: { id: 'claim-3' }, error: null });

    await DatabaseService.createClaim(baseParams);

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0]).toMatchObject({
      status: 'pending',
    });
  });

  it('inserts consent_at from params', async () => {
    const { calls } = setupMock({ data: { id: 'claim-4' }, error: null });

    await DatabaseService.createClaim({ ...baseParams, consentAt: '2026-01-01T00:00:00.000Z' });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0]).toMatchObject({
      consent_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('inserts tax_number from params', async () => {
    const { calls } = setupMock({ data: { id: 'claim-5' }, error: null });

    await DatabaseService.createClaim({ ...baseParams, taxNumber: '0010376345' });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0]).toMatchObject({
      tax_number: '0010376345',
    });
  });

  it('inserts optional geo coords when provided', async () => {
    const { calls } = setupMock({ data: { id: 'claim-6' }, error: null });

    await DatabaseService.createClaim({
      ...baseParams,
      capturedLat: 41.0082,
      capturedLng: 28.9784,
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0]).toMatchObject({
      captured_lat: 41.0082,
      captured_lng: 28.9784,
    });
  });

  it('inserts liveness_nonce when provided', async () => {
    const { calls } = setupMock({ data: { id: 'claim-7' }, error: null });

    await DatabaseService.createClaim({ ...baseParams, livenessNonce: 'nonce-abc123' });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0]).toMatchObject({
      liveness_nonce: 'nonce-abc123',
    });
  });

  it('returns the claim id on success', async () => {
    setupMock({ data: { id: 'claim-return' }, error: null });

    const id = await DatabaseService.createClaim(baseParams);

    expect(id).toBe('claim-return');
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'RLS denied', code: '42501' } });

    await expect(DatabaseService.createClaim(baseParams)).rejects.toMatchObject({
      message: 'RLS denied',
    });
  });
});

// ---------------------------------------------------------------------------
// uploadVerificationVideo
// ---------------------------------------------------------------------------

describe('DatabaseService.uploadVerificationVideo', () => {
  beforeEach(() => {
    // Mock global fetch for file upload
    global.fetch = jest.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['video'], { type: 'video/mp4' })),
      } as any)
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads to bilinc-verification bucket at correct path', async () => {
    const storageMock = {
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://x/y.mp4' } })),
    };
    const fromMock = jest.fn(() => storageMock);
    // Also mock the update call for the claim row
    const builderMock: any = {};
    const chainMethods = ['select', 'update', 'eq', 'single'];
    chainMethods.forEach(m => {
      builderMock[m] = jest.fn((...args: any[]) => builderMock);
    });
    builderMock.then = (resolve: (v: any) => any) =>
      Promise.resolve({ data: { id: 'c1' }, error: null }).then(resolve);

    const clientMock = {
      from: jest.fn(() => builderMock),
      storage: { from: fromMock },
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })) },
    };
    mockContainer.client = clientMock;

    const path = await DatabaseService.uploadVerificationVideo('user-1', 'claim-1', 'file:///tmp/video.mp4');

    expect(fromMock).toHaveBeenCalledWith('bilinc-verification');
    expect(storageMock.upload).toHaveBeenCalledWith(
      'user-1/claim-1/video.mp4',
      expect.anything(),
      expect.objectContaining({ contentType: 'video/mp4' })
    );
    expect(path).toBe('user-1/claim-1/video.mp4');
  });

  it('throws when storage upload returns an error', async () => {
    const storageMock = {
      upload: jest.fn(() => Promise.resolve({ error: { message: 'storage error' } })),
    };
    const fromMock = jest.fn(() => storageMock);
    mockContainer.client = {
      from: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      })),
      storage: { from: fromMock },
    };

    await expect(
      DatabaseService.uploadVerificationVideo('user-1', 'claim-1', 'file:///tmp/video.mp4')
    ).rejects.toMatchObject({ message: 'storage error' });
  });
});
