/**
 * Service unit tests for DatabaseService — voting methods.
 * Covers: voteOnFact, voteOnReview, deleteFactVote, deleteReviewVote.
 *
 * Key edge cases from the Addendum:
 * - First vote inserts (upsert)
 * - Same user re-vote = upsert not duplicate (onConflict is set correctly)
 * - Un-vote deletes
 * - Error propagation for each
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
// voteOnFact
// ---------------------------------------------------------------------------

describe('DatabaseService.voteOnFact', () => {
  it('upserts into "fact_votes" table with fact_id and vote_type', async () => {
    const { client, calls } = setupMock({
      data: { fact_id: 'f1', user_id: 'u1', vote_type: 'helpful' },
      error: null,
    });

    const result = await DatabaseService.voteOnFact('f1', 'helpful');

    expect(client.from).toHaveBeenCalledWith('fact_votes');
    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall).toBeDefined();
    // The upserted row contains fact_id and vote_type
    expect(upsertCall![1][0]).toMatchObject({
      fact_id: 'f1',
      vote_type: 'helpful',
    });
    // The onConflict option is set for same-user re-vote (upsert path)
    expect(upsertCall![1][1]).toMatchObject({ onConflict: 'fact_id,user_id' });
    expect(result).toMatchObject({ fact_id: 'f1', vote_type: 'helpful' });
  });

  it('upserts with not_helpful vote type', async () => {
    const { calls } = setupMock({
      data: { fact_id: 'f2', vote_type: 'not_helpful' },
      error: null,
    });

    await DatabaseService.voteOnFact('f2', 'not_helpful');

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][0].vote_type).toBe('not_helpful');
  });

  it('uses onConflict "fact_id,user_id" to handle same-user re-vote without duplicate', async () => {
    // This is the crucial re-vote path: same user voting again should upsert, not error
    const { calls } = setupMock({
      data: { fact_id: 'f1', vote_type: 'helpful' },
      error: null,
    });

    await DatabaseService.voteOnFact('f1', 'helpful');

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][1]).toEqual({ onConflict: 'fact_id,user_id' });
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'vote failed' } });

    await expect(DatabaseService.voteOnFact('f1', 'helpful')).rejects.toMatchObject({
      message: 'vote failed',
    });
  });
});

// ---------------------------------------------------------------------------
// voteOnReview
// ---------------------------------------------------------------------------

describe('DatabaseService.voteOnReview', () => {
  it('upserts into "review_votes" table with review_id and vote_type', async () => {
    const { client, calls } = setupMock({
      data: { review_id: 'r1', vote_type: 'helpful' },
      error: null,
    });

    const result = await DatabaseService.voteOnReview('r1', 'helpful');

    expect(client.from).toHaveBeenCalledWith('review_votes');
    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall).toBeDefined();
    expect(upsertCall![1][0]).toMatchObject({
      review_id: 'r1',
      vote_type: 'helpful',
    });
    expect(upsertCall![1][1]).toMatchObject({ onConflict: 'review_id,user_id' });
    expect(result).toMatchObject({ review_id: 'r1' });
  });

  it('uses onConflict "review_id,user_id" for same-user re-vote path', async () => {
    const { calls } = setupMock({
      data: { review_id: 'r1', vote_type: 'not_helpful' },
      error: null,
    });

    await DatabaseService.voteOnReview('r1', 'not_helpful');

    const upsertCall = calls.find(c => c[0] === 'upsert');
    expect(upsertCall![1][1]).toEqual({ onConflict: 'review_id,user_id' });
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'review vote error' } });

    await expect(DatabaseService.voteOnReview('r1', 'helpful')).rejects.toMatchObject({
      message: 'review vote error',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteFactVote (un-vote a fact)
// ---------------------------------------------------------------------------

describe('DatabaseService.deleteFactVote', () => {
  it('deletes from "fact_votes" table filtered by fact_id', async () => {
    const { client, calls } = setupMock({ data: null, error: null });

    await DatabaseService.deleteFactVote('fact-11');

    expect(client.from).toHaveBeenCalledWith('fact_votes');
    const deleteCall = calls.find(c => c[0] === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = calls.find(c => c[0] === 'eq');
    expect(eqCall![1]).toEqual(['fact_id', 'fact-11']);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'delete fact vote failed' } });

    await expect(DatabaseService.deleteFactVote('f1')).rejects.toMatchObject({
      message: 'delete fact vote failed',
    });
  });

  it('resolves without a return value on success', async () => {
    setupMock({ data: null, error: null });
    const result = await DatabaseService.deleteFactVote('f1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteReviewVote (un-vote a review)
// ---------------------------------------------------------------------------

describe('DatabaseService.deleteReviewVote', () => {
  it('deletes from "review_votes" table filtered by review_id', async () => {
    const { client, calls } = setupMock({ data: null, error: null });

    await DatabaseService.deleteReviewVote('review-55');

    expect(client.from).toHaveBeenCalledWith('review_votes');
    const deleteCall = calls.find(c => c[0] === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = calls.find(c => c[0] === 'eq');
    expect(eqCall![1]).toEqual(['review_id', 'review-55']);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'delete review vote failed' } });

    await expect(DatabaseService.deleteReviewVote('r1')).rejects.toMatchObject({
      message: 'delete review vote failed',
    });
  });

  it('resolves without a return value on success', async () => {
    setupMock({ data: null, error: null });
    const result = await DatabaseService.deleteReviewVote('r1');
    expect(result).toBeUndefined();
  });
});
