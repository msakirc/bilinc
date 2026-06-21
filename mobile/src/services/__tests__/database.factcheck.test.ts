/**
 * Service unit tests for DatabaseService.submitFactCheck.
 * Covers: all three vote types, optional comment/evidenceUrl, error path, upsert behavior.
 *
 * fact_checks table (from db/tables.sql):
 *   fact_id UUID NOT NULL, user_id UUID NOT NULL,
 *   vote TEXT NOT NULL CHECK (vote IN ('verify', 'dispute', 'needs_evidence')),
 *   comment TEXT, evidence_url TEXT,
 *   UNIQUE(fact_id, user_id)  ← upsert on conflict
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
  searchNearby: jest.fn(),
}));

import { DatabaseService } from '../database';

function setupMock(result: { data?: any; error?: any }) {
  const mock = makeSupabaseMock(result);
  mockContainer.client = mock.client;
  return mock;
}

// ---------------------------------------------------------------------------
// DatabaseService.submitFactCheck
// ---------------------------------------------------------------------------

describe('DatabaseService.submitFactCheck', () => {
  it('upserts into "fact_checks" table with vote="verify"', async () => {
    const { client, calls } = setupMock({
      data: { id: 'fc1', fact_id: 'f1', vote: 'verify' },
      error: null,
    });

    const result = await DatabaseService.submitFactCheck({
      factId: 'f1',
      vote: 'verify',
    });

    expect(client.from).toHaveBeenCalledWith('fact_checks');
    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1][0]).toMatchObject({
      fact_id: 'f1',
      vote: 'verify',
    });
    expect(result).toMatchObject({ id: 'fc1' });
  });

  it('upserts with vote="dispute"', async () => {
    const { calls } = setupMock({ data: { id: 'fc2' }, error: null });

    await DatabaseService.submitFactCheck({ factId: 'f2', vote: 'dispute' });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0]).toMatchObject({ fact_id: 'f2', vote: 'dispute' });
  });

  it('upserts with vote="needs_evidence"', async () => {
    const { calls } = setupMock({ data: { id: 'fc3' }, error: null });

    await DatabaseService.submitFactCheck({ factId: 'f3', vote: 'needs_evidence' });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0]).toMatchObject({ fact_id: 'f3', vote: 'needs_evidence' });
  });

  it('includes comment in the upsert payload when provided', async () => {
    const { calls } = setupMock({ data: { id: 'fc4' }, error: null });

    await DatabaseService.submitFactCheck({
      factId: 'f4',
      vote: 'dispute',
      comment: 'This claim is inaccurate',
    });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0].comment).toBe('This claim is inaccurate');
  });

  it('includes evidence_url in the upsert payload when provided', async () => {
    const { calls } = setupMock({ data: { id: 'fc5' }, error: null });

    await DatabaseService.submitFactCheck({
      factId: 'f5',
      vote: 'verify',
      evidenceUrl: 'https://example.com/proof.pdf',
    });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0].evidence_url).toBe('https://example.com/proof.pdf');
  });

  it('omits comment from payload when not provided', async () => {
    const { calls } = setupMock({ data: { id: 'fc6' }, error: null });

    await DatabaseService.submitFactCheck({ factId: 'f6', vote: 'verify' });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0]).not.toHaveProperty('comment');
  });

  it('omits evidence_url from payload when not provided', async () => {
    const { calls } = setupMock({ data: { id: 'fc7' }, error: null });

    await DatabaseService.submitFactCheck({ factId: 'f7', vote: 'dispute' });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0]).not.toHaveProperty('evidence_url');
  });

  it('upserts onConflict "fact_id,user_id" (one-per-user-per-fact constraint)', async () => {
    const { calls } = setupMock({ data: { id: 'fc8' }, error: null });

    await DatabaseService.submitFactCheck({ factId: 'f8', vote: 'verify' });

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall).toBeDefined();
    // The second argument to upsert() is the options object with onConflict
    expect(upsertCall![1][1]).toMatchObject({ onConflict: 'fact_id,user_id' });
  });

  it('throws when Supabase returns an error (e.g. RLS denial)', async () => {
    setupMock({ data: null, error: { message: 'RLS denied', code: '42501' } });

    await expect(
      DatabaseService.submitFactCheck({ factId: 'f9', vote: 'verify' })
    ).rejects.toMatchObject({ message: 'RLS denied' });
  });
});
