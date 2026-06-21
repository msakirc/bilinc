/**
 * Service unit tests for DatabaseService — review-related methods.
 * Covers: submitReview, deleteReview, getListingReviews, getUserReviews, getUserFacts.
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
// submitReview
// ---------------------------------------------------------------------------

describe('DatabaseService.submitReview', () => {
  it('inserts into "reviews" table with listing_id, rating, and content', async () => {
    const { client, calls } = setupMock({
      data: { id: 'r1', listing_id: 'l1', rating: 4, content: 'Great place' },
      error: null,
    });

    const result = await DatabaseService.submitReview({
      listingId: 'l1',
      rating: 4,
      content: 'Great place',
    });

    expect(client.from).toHaveBeenCalledWith('reviews');
    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall).toBeDefined();
    expect(insertCall![1][0]).toMatchObject({
      listing_id: 'l1',
      rating: 4,
      content: 'Great place',
    });
    expect(result).toMatchObject({ id: 'r1' });
  });

  it('includes optional title in insert when provided', async () => {
    const { calls } = setupMock({ data: { id: 'r2' }, error: null });

    await DatabaseService.submitReview({
      listingId: 'l1',
      rating: 5,
      title: 'Amazing!',
      content: 'Loved it',
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    expect(insertCall![1][0].title).toBe('Amazing!');
  });

  it('sends title as undefined when not provided', async () => {
    const { calls } = setupMock({ data: { id: 'r3' }, error: null });

    await DatabaseService.submitReview({
      listingId: 'l1',
      rating: 3,
      content: 'Okay',
    });

    const insertCall = calls.find(c => c[0] === 'insert');
    // title key should either be absent or undefined — not a hardcoded string
    expect(insertCall![1][0].title).toBeUndefined();
  });

  it('throws on Supabase error (e.g. duplicate review from same user)', async () => {
    setupMock({ data: null, error: { message: 'unique constraint violation', code: '23505' } });

    await expect(
      DatabaseService.submitReview({ listingId: 'l1', rating: 4, content: 'Again' })
    ).rejects.toMatchObject({ message: 'unique constraint violation' });
  });

  it('throws on RLS denial', async () => {
    setupMock({ data: null, error: { message: 'new row violates row-level security', code: '42501' } });

    await expect(
      DatabaseService.submitReview({ listingId: 'l1', rating: 1, content: 'Bad' })
    ).rejects.toMatchObject({ message: 'new row violates row-level security' });
  });
});

// ---------------------------------------------------------------------------
// deleteReview
// ---------------------------------------------------------------------------

describe('DatabaseService.deleteReview', () => {
  it('deletes from "reviews" table with the given review id', async () => {
    const { client, calls } = setupMock({ data: null, error: null });

    await DatabaseService.deleteReview('review-42');

    expect(client.from).toHaveBeenCalledWith('reviews');
    const deleteCall = calls.find(c => c[0] === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = calls.find(c => c[0] === 'eq');
    expect(eqCall![1]).toEqual(['id', 'review-42']);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'cannot delete another user review' } });

    await expect(DatabaseService.deleteReview('r1')).rejects.toMatchObject({
      message: 'cannot delete another user review',
    });
  });

  it('resolves without a return value on success', async () => {
    setupMock({ data: null, error: null });
    const result = await DatabaseService.deleteReview('r1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getListingReviews
// ---------------------------------------------------------------------------

describe('DatabaseService.getListingReviews', () => {
  it('queries "reviews" table filtered by listing_id and is_flagged=false', async () => {
    const reviewData = [{ id: 'r1', listing_id: 'l1', rating: 4, content: 'Good' }];
    const { client, calls } = setupMock({ data: reviewData, error: null });

    const result = await DatabaseService.getListingReviews('l1');

    expect(client.from).toHaveBeenCalledWith('reviews');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const listingEq = eqCalls.find(c => c[1][0] === 'listing_id');
    expect(listingEq![1]).toEqual(['listing_id', 'l1']);
    const flaggedEq = eqCalls.find(c => c[1][0] === 'is_flagged');
    expect(flaggedEq![1]).toEqual(['is_flagged', false]);
    expect(result).toEqual(reviewData);
  });

  it('returns empty array when data is null', async () => {
    setupMock({ data: null, error: null });
    const result = await DatabaseService.getListingReviews('l-empty');
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'reviews query failed' } });
    await expect(DatabaseService.getListingReviews('l1')).rejects.toMatchObject({ message: 'reviews query failed' });
  });
});

// ---------------------------------------------------------------------------
// getUserReviews
// ---------------------------------------------------------------------------

describe('DatabaseService.getUserReviews', () => {
  it('queries "reviews" table filtered by user_id', async () => {
    const rawRow = { id: 'r1', user_id: 'u1', listing_name: 'Test Cafe', listing_slug: 'test-cafe' };
    const { client, calls } = setupMock({ data: [rawRow], error: null });

    const result = await DatabaseService.getUserReviews('u1');

    expect(client.from).toHaveBeenCalledWith('reviews');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const userEq = eqCalls.find(c => c[1][0] === 'user_id');
    expect(userEq![1]).toEqual(['user_id', 'u1']);
    // getUserReviews maps listing_name/listing_slug to nested { listing: { name, slug } }
    expect(result[0].listing).toEqual({ name: 'Test Cafe', slug: 'test-cafe' });
  });

  it('maps listing to undefined when listing_name is absent', async () => {
    setupMock({ data: [{ id: 'r2', user_id: 'u1' }], error: null });

    const result = await DatabaseService.getUserReviews('u1');
    expect(result[0].listing).toBeUndefined();
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'user reviews query failed' } });
    await expect(DatabaseService.getUserReviews('u1')).rejects.toMatchObject({ message: 'user reviews query failed' });
  });
});

// ---------------------------------------------------------------------------
// getUserFacts
// ---------------------------------------------------------------------------

describe('DatabaseService.getUserFacts', () => {
  it('queries "facts" table filtered by user_id', async () => {
    const rawRow = { id: 'f1', user_id: 'u1', listing_name: 'Market X', listing_slug: 'market-x' };
    const { client, calls } = setupMock({ data: [rawRow], error: null });

    const result = await DatabaseService.getUserFacts('u1');

    expect(client.from).toHaveBeenCalledWith('facts');
    const eqCalls = calls.filter(c => c[0] === 'eq');
    const userEq = eqCalls.find(c => c[1][0] === 'user_id');
    expect(userEq![1]).toEqual(['user_id', 'u1']);
    // getUserFacts maps denormalized columns to nested listing shape
    expect(result[0].listing).toEqual({ name: 'Market X', slug: 'market-x' });
  });

  it('maps listing to undefined when listing_name is absent', async () => {
    setupMock({ data: [{ id: 'f2', user_id: 'u1' }], error: null });
    const result = await DatabaseService.getUserFacts('u1');
    expect(result[0].listing).toBeUndefined();
  });

  it('throws on Supabase error', async () => {
    setupMock({ data: null, error: { message: 'user facts query failed' } });
    await expect(DatabaseService.getUserFacts('u1')).rejects.toMatchObject({ message: 'user facts query failed' });
  });
});
