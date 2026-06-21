/**
 * Service unit tests for DatabaseService — fact-related methods.
 * Covers: submitFact, deleteFact, getListingFacts, getRecentVerifiedFacts, getTagsisFacts.
 *
 * Mocks only the Supabase client boundary. The DatabaseService code under test
 * is the real implementation.
 */

import { makeSupabaseMock } from '../../../test/mocks/supabase';

// Shared mock container — filled per-test via setupMock()
const mockContainer = { client: null as any };

jest.mock('../supabase', () => ({
  supabase: new Proxy({}, {
    get(_target, prop) {
      return (mockContainer.client as any)[prop];
    },
  }),
}));

// Also mock dynamodb and search so they don't initiate real connections
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
// submitFact
// ---------------------------------------------------------------------------

describe('DatabaseService.submitFact', () => {
  it('inserts into "facts" table with all correct fields', async () => {
    const { client, calls } = setupMock({
      data: { id: 'f1', listing_id: 'l1', statement: 'unsafe', category: 'safety', truth_guarantee: true, verification_status: 'pending' },
      error: null,
    });

    const result = await DatabaseService.submitFact({
      listingId: 'l1',
      statement: 'unsafe',
      category: 'safety',
      truthGuarantee: true,
    });

    expect(client.from).toHaveBeenCalledWith('facts');
    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall).toBeDefined();
    expect(insertCall![1][0]).toMatchObject({
      listing_id: 'l1',
      statement: 'unsafe',
      category: 'safety',
      truth_guarantee: true,
      verification_status: 'pending',
    });
    expect(result).toMatchObject({ id: 'f1' });
  });

  it('defaults truthGuarantee to true when not specified', async () => {
    const { calls } = setupMock({ data: { id: 'f2' }, error: null });

    await DatabaseService.submitFact({
      listingId: 'l1',
      statement: 's',
      category: 'health',
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0].truth_guarantee).toBe(true);
  });

  it('sends the specified category correctly (labor category)', async () => {
    const { calls } = setupMock({ data: { id: 'f3' }, error: null });

    await DatabaseService.submitFact({
      listingId: 'l2',
      statement: 'Worker mistreated',
      category: 'labor',
      truthGuarantee: true,
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0].category).toBe('labor');
  });

  it('always sets verification_status to "pending" on insert', async () => {
    const { calls } = setupMock({ data: { id: 'f4' }, error: null });

    await DatabaseService.submitFact({
      listingId: 'l1',
      statement: 's',
      category: 'environmental',
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0].verification_status).toBe('pending');
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'RLS denied', code: '42501' } });

    await expect(
      DatabaseService.submitFact({ listingId: 'l1', statement: 's', category: 'safety' })
    ).rejects.toMatchObject({ message: 'RLS denied' });
  });
});

// ---------------------------------------------------------------------------
// deleteFact
// ---------------------------------------------------------------------------

describe('DatabaseService.deleteFact', () => {
  it('deletes from "facts" table with the given fact id', async () => {
    const { client, calls } = setupMock({ data: null, error: null });

    await DatabaseService.deleteFact('fact-999');

    expect(client.from).toHaveBeenCalledWith('facts');
    const deleteCall = calls.find(c => c[0] === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = calls.find(c => c[0] === 'eq');
    expect(eqCall).toBeDefined();
    expect(eqCall![1]).toEqual(['id', 'fact-999']);
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'not found' } });

    await expect(DatabaseService.deleteFact('bad-id')).rejects.toMatchObject({ message: 'not found' });
  });

  it('resolves without a return value on success', async () => {
    setupMock({ data: null, error: null });
    const result = await DatabaseService.deleteFact('f1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getListingFacts
// ---------------------------------------------------------------------------

describe('DatabaseService.getListingFacts', () => {
  it('queries "facts" table filtered by listing_id and is_flagged=false', async () => {
    const factsData = [{ id: 'f1', listing_id: 'l1', statement: 'Fact one', category: 'safety' }];
    const { client, calls } = setupMock({ data: factsData, error: null });

    const result = await DatabaseService.getListingFacts('l1');

    expect(client.from).toHaveBeenCalledWith('facts');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const listingEq = eqCalls.find(c => c[1][0] === 'listing_id');
    expect(listingEq![1]).toEqual(['listing_id', 'l1']);
    const flaggedEq = eqCalls.find(c => c[1][0] === 'is_flagged');
    expect(flaggedEq![1]).toEqual(['is_flagged', false]);
    expect(result).toEqual(factsData);
  });

  it('returns empty array when data is null (no facts found)', async () => {
    setupMock({ data: null, error: null });

    const result = await DatabaseService.getListingFacts('l-empty');
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'DB error' } });

    await expect(DatabaseService.getListingFacts('l1')).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ---------------------------------------------------------------------------
// getRecentVerifiedFacts
// ---------------------------------------------------------------------------

describe('DatabaseService.getRecentVerifiedFacts', () => {
  it('queries facts filtered by verification_status=verified and is_flagged=false', async () => {
    const { client, calls } = setupMock({ data: [], error: null });

    await DatabaseService.getRecentVerifiedFacts(5);

    expect(client.from).toHaveBeenCalledWith('facts');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const statusEq = eqCalls.find(c => c[1][0] === 'verification_status');
    expect(statusEq![1]).toEqual(['verification_status', 'verified']);
    const flaggedEq = eqCalls.find(c => c[1][0] === 'is_flagged');
    expect(flaggedEq![1]).toEqual(['is_flagged', false]);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'query failed' } });
    await expect(DatabaseService.getRecentVerifiedFacts()).rejects.toMatchObject({ message: 'query failed' });
  });
});

// ---------------------------------------------------------------------------
// getTagsisFacts (safety-category facts)
// ---------------------------------------------------------------------------

describe('DatabaseService.getTagsisFacts', () => {
  it('queries facts filtered by category=safety, verification_status=verified, is_flagged=false', async () => {
    const { client, calls } = setupMock({ data: [], error: null });

    await DatabaseService.getTagsisFacts(10);

    expect(client.from).toHaveBeenCalledWith('facts');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const catEq = eqCalls.find(c => c[1][0] === 'category');
    expect(catEq![1]).toEqual(['category', 'safety']);
    const statusEq = eqCalls.find(c => c[1][0] === 'verification_status');
    expect(statusEq![1]).toEqual(['verification_status', 'verified']);
    const flaggedEq = eqCalls.find(c => c[1][0] === 'is_flagged');
    expect(flaggedEq![1]).toEqual(['is_flagged', false]);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'tağşiş query failed' } });
    await expect(DatabaseService.getTagsisFacts()).rejects.toMatchObject({ message: 'tağşiş query failed' });
  });
});

// ---------------------------------------------------------------------------
// NOTE: fact_checks service method is now implemented
// ---------------------------------------------------------------------------
// DatabaseService.submitFactCheck() was added to database.ts as part of
// Bug 3 fix. It upserts into fact_checks (onConflict fact_id,user_id) with
// vote IN ('verify','dispute','needs_evidence') and optional comment/evidence_url.
// Full test coverage lives in database.factcheck.test.ts.
// UI wiring (verify/dispute buttons) is a separate task.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// submitFact — edge cases
// ---------------------------------------------------------------------------

describe('DatabaseService.submitFact — edge cases', () => {
  it('passes an invalid category string through to the DB unchanged (no service-level guard)', async () => {
    // BEHAVIOR NOTE: The service does not validate the category value.
    // The DB CHECK constraint is the real enforcement gate. If the DB is mocked
    // here the insert succeeds — which documents that defense lives at the DB layer.
    const { calls } = setupMock({ data: { id: 'f-edge' }, error: null });

    await DatabaseService.submitFact({
      listingId: 'l1',
      statement: 'Some claim',
      category: 'definitely_not_a_valid_category',
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall).toBeDefined();
    // The service passes the caller-supplied value straight through.
    expect(insertCall![1][0].category).toBe('definitely_not_a_valid_category');
  });
});

// ---------------------------------------------------------------------------
// voteOnFact — edge cases
// ---------------------------------------------------------------------------

describe('DatabaseService.voteOnFact — edge cases', () => {
  it('does NOT block a user from voting on their own fact (no ownership guard in service)', async () => {
    // BEHAVIOR NOTE: The service has no check comparing the fact's author
    // against the current user. Self-voting is allowed or denied exclusively
    // by DB RLS rules, not by this method.
    const { calls } = setupMock({ data: { id: 'fv1', fact_id: 'f-own', vote_type: 'helpful' }, error: null });

    // Simulate voting on a fact the caller owns — the service does not know and does not check.
    const result = await DatabaseService.voteOnFact('f-own', 'helpful');

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1][0]).toMatchObject({ fact_id: 'f-own', vote_type: 'helpful' });
    expect(result).toMatchObject({ id: 'fv1' });
  });
});
