/**
 * BusinessDetailScreen component tests.
 * Covers: section ordering, fact/review vote interactions, toggle-to-delete, guest guard (FINDING).
 * HONESTY RULES enforced: every assertion reflects real, observable behaviour.
 */
import React from 'react';
import { renderWithProviders, fireEvent, waitFor } from '../render';
import { aUser } from '../factories';
import BusinessDetailScreen from '../../app/business/[id]/index';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockBack = jest.fn();
let mockPush = jest.fn();
let mockVoteOnFact = jest.fn();
let mockVoteOnReview = jest.fn();
let mockDeleteFactVote = jest.fn();
let mockDeleteReviewVote = jest.fn();
let mockGetListing = jest.fn();
let mockGetListingFacts = jest.fn();
let mockGetListingReviews = jest.fn();

// The auth mock reads mockUser at call time so it can be reassigned per-test.
let mockUser: any = aUser({ id: 'u1' });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: 'listing-123' }),
}));

jest.mock('@/src/store/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

jest.mock('@/src/services/database', () => ({
  DatabaseService: {
    getListing: (...args: any[]) => mockGetListing(...args),
    getListingFacts: (...args: any[]) => mockGetListingFacts(...args),
    getListingReviews: (...args: any[]) => mockGetListingReviews(...args),
    voteOnFact: (...args: any[]) => mockVoteOnFact(...args),
    voteOnReview: (...args: any[]) => mockVoteOnReview(...args),
    deleteFactVote: (...args: any[]) => mockDeleteFactVote(...args),
    deleteReviewVote: (...args: any[]) => mockDeleteReviewVote(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderDetail() {
  return renderWithProviders(<BusinessDetailScreen />);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = aUser({ id: 'u1' });
  // Real-shaped data from the (mocked) data layer — facts/reviews keyed id '1'
  // so the vote-button testIDs (fact-vote-up-1 / review-vote-up-1) render.
  mockGetListing.mockResolvedValue({
    id: 'listing-123',
    name: 'Test İşletme',
    slug: 'test-isletme',
    entity_type: 'business',
    average_rating: 4.2,
    total_reviews: 2,
    categories: ['Kafe'],
  });
  mockGetListingFacts.mockResolvedValue([
    {
      id: '1',
      statement: 'Test bilgi beyanı',
      category: 'quality',
      verification_status: 'verified',
      helpful_count: 5,
      user: { username: 'tester', reputation_score: 200, credibility_level: 'contributor' },
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  mockGetListingReviews.mockResolvedValue([
    {
      id: '1',
      rating: 4,
      content: 'Güzel bir yer, tavsiye ederim.',
      helpful_count: 3,
      user: { username: 'reviewer', reputation_score: 150, credibility_level: 'contributor' },
      created_at: '2026-01-02T00:00:00Z',
    },
  ]);
  mockVoteOnFact.mockResolvedValue(undefined);
  mockVoteOnReview.mockResolvedValue(undefined);
  mockDeleteFactVote.mockResolvedValue(undefined);
  mockDeleteReviewVote.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BusinessDetailScreen', () => {
  it('facts section heading appears before reviews section heading in the DOM', async () => {
    const { getByTestId, UNSAFE_getAllByProps } = renderDetail();

    await waitFor(() => {
      expect(getByTestId('business-facts-section')).toBeTruthy();
      expect(getByTestId('business-reviews-section')).toBeTruthy();
    });

    // Build an ordered list of testIDs by querying both in one flattened pass.
    // UNSAFE_getAllByProps({}) returns nodes in render order (depth-first), so
    // comparing indices tells us which section appears first in the tree.
    // This assertion FAILS if the two sections are swapped in JSX.
    const allWithEither = UNSAFE_getAllByProps({}).filter(
      (n: any) =>
        n.props?.testID === 'business-facts-section' ||
        n.props?.testID === 'business-reviews-section',
    );

    expect(allWithEither.length).toBeGreaterThanOrEqual(2);
    // First encountered must be the facts section.
    expect(allWithEither[0].props.testID).toBe('business-facts-section');
    // At least one reviews section must follow.
    const reviewsIdx = allWithEither.findIndex(
      (n: any) => n.props?.testID === 'business-reviews-section',
    );
    expect(reviewsIdx).toBeGreaterThan(0);
  });

  it('upvoting a fact calls voteOnFact with (factId, "helpful")', async () => {
    const { getByTestId } = renderDetail();

    // Wait for the screen to finish loading (dataLoading = false → mockFacts rendered)
    await waitFor(() => getByTestId('fact-vote-up-1'));

    fireEvent.press(getByTestId('fact-vote-up-1'));

    await waitFor(() =>
      expect(mockVoteOnFact).toHaveBeenCalledWith('1', 'helpful')
    );
  });

  it('downvoting a fact calls voteOnFact with (factId, "not_helpful")', async () => {
    const { getByTestId } = renderDetail();

    await waitFor(() => getByTestId('fact-vote-down-1'));

    fireEvent.press(getByTestId('fact-vote-down-1'));

    await waitFor(() =>
      expect(mockVoteOnFact).toHaveBeenCalledWith('1', 'not_helpful')
    );
  });

  it('upvoting a review calls voteOnReview with (reviewId, "helpful")', async () => {
    const { getByTestId } = renderDetail();

    await waitFor(() => getByTestId('review-vote-up-1'));

    fireEvent.press(getByTestId('review-vote-up-1'));

    await waitFor(() =>
      expect(mockVoteOnReview).toHaveBeenCalledWith('1', 'helpful')
    );
  });

  it('second press on already-upvoted fact calls deleteFactVote (toggle to remove)', async () => {
    // BEHAVIOR: handleVote checks currentVote === voteType → if same, newVote = null
    // → calls deleteFactVote instead of voteOnFact.
    const { getByTestId } = renderDetail();

    await waitFor(() => getByTestId('fact-vote-up-1'));

    // First press: no current vote → newVote = 'up' → calls voteOnFact
    fireEvent.press(getByTestId('fact-vote-up-1'));
    await waitFor(() => expect(mockVoteOnFact).toHaveBeenCalledWith('1', 'helpful'));

    // Second press: currentVote = 'up' === dir = 'up' → newVote = null → calls deleteFactVote
    fireEvent.press(getByTestId('fact-vote-up-1'));
    await waitFor(() => expect(mockDeleteFactVote).toHaveBeenCalledWith('1'));
  });

  it('guest user (user=null) pressing a vote button is redirected to login, not voted', async () => {
    // CORRECT BEHAVIOR: Vote buttons remain visible (guests can see them), but pressing
    // a vote button as a guest must push to /(auth)/login and must NOT call voteOnFact.
    mockUser = null;

    const { getByTestId } = renderDetail();

    // Vote buttons must still be visible to guests (not hidden)
    await waitFor(() => expect(getByTestId('fact-vote-up-1')).toBeTruthy());

    // Pressing the vote button as a guest must redirect to login
    fireEvent.press(getByTestId('fact-vote-up-1'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/(auth)/login')
    );

    // Must NOT have called the vote service
    expect(mockVoteOnFact).not.toHaveBeenCalled();
  });

  it('authenticated user pressing a vote button calls voteOnFact (not redirected)', async () => {
    // Verify that the guest-guard does not affect authenticated users.
    // mockUser is already set to aUser({ id: 'u1' }) in beforeEach.
    const { getByTestId } = renderDetail();

    await waitFor(() => getByTestId('fact-vote-up-1'));
    fireEvent.press(getByTestId('fact-vote-up-1'));

    await waitFor(() =>
      expect(mockVoteOnFact).toHaveBeenCalledWith('1', 'helpful')
    );
    expect(mockPush).not.toHaveBeenCalledWith('/(auth)/login');
  });
});
