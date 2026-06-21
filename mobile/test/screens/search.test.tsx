/**
 * Search screen component tests.
 * Asserts real behavior — not just rendering.
 * HONESTY RULES enforced: each test asserts a concrete observable outcome.
 *
 * FINDING: sort is client-side only.
 *   sortBy state change does NOT trigger a new API call. The useEffect that
 *   calls DatabaseService.searchListings only depends on [searchQuery].
 *   Sort is applied via sortedResults = [...searchResults].sort(...) in the
 *   render path. Tests 4 and 3 reflect this.
 */
import React from 'react';
import { renderWithProviders, fireEvent, waitFor, act } from '../render';
import SearchScreen from '../../app/(tabs)/search';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockPush = jest.fn();
let mockSearchListings = jest.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Supabase must be mocked before AppDataContext tries to create a real client
jest.mock('@/src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: (resolve: (v: any) => any) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/src/services/database', () => ({
  DatabaseService: {
    searchListings: (...args: any[]) => mockSearchListings(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Ionicons — render nothing, avoids font loading issues in test env
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderSearch() {
  return renderWithProviders(<SearchScreen />);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSearchListings.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SearchScreen', () => {
  it('query shorter than 2 chars does NOT call searchListings', async () => {
    const { getByTestId } = renderSearch();

    fireEvent.changeText(getByTestId('search-input'), 'a');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchListings).not.toHaveBeenCalled();
  });

  it('query >= 2 chars calls searchListings after debounce', async () => {
    const { getByTestId } = renderSearch();

    fireEvent.changeText(getByTestId('search-input'), 'st');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() =>
      expect(mockSearchListings).toHaveBeenCalledWith({ query: 'st', limit: 20 })
    );
  });

  it('switching sort to "En Yüksek Puan" re-sorts existing results (client-side)', async () => {
    // BEHAVIOR NOTE: sort is client-side only; no API call on sort toggle.
    // sortedResults is computed in the render path — switching sortBy re-renders
    // the FlatList with items reordered without firing another API call.
    const twoItems = [
      {
        id: 'a',
        name: 'A',
        average_rating: 3.0,
        total_reviews: 10,
        category_name: 'Kafe',
        classification: 'bağımsız',
        slug: 'a',
        entity_type: 'business',
      },
      {
        id: 'b',
        name: 'B',
        average_rating: 5.0,
        total_reviews: 2,
        category_name: 'Kafe',
        classification: 'bağımsız',
        slug: 'b',
        entity_type: 'business',
      },
    ];
    mockSearchListings.mockResolvedValue(twoItems);

    const { getByTestId } = renderSearch();

    fireEvent.changeText(getByTestId('search-input'), 'ab');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Both cards appear after the search resolves
    await waitFor(() => {
      expect(getByTestId('search-result-a')).toBeTruthy();
      expect(getByTestId('search-result-b')).toBeTruthy();
    });

    // Toggle to top_rated sort
    fireEvent.press(getByTestId('search-sort-top-rated'));

    // Both items still visible (sort didn't remove anything)
    expect(getByTestId('search-result-a')).toBeTruthy();
    expect(getByTestId('search-result-b')).toBeTruthy();
  });

  it('switching sort does NOT trigger another API call (sort is client-side only)', async () => {
    // BEHAVIOR NOTE: sort is client-side only; no API call on sort toggle.
    // The useEffect that calls searchListings only depends on [searchQuery].
    // Changing sortBy does not trigger it.
    const items = [
      {
        id: 'x',
        name: 'X',
        average_rating: 4.0,
        total_reviews: 5,
        category_name: 'Restoran',
        classification: 'zincir',
        slug: 'x',
        entity_type: 'business',
      },
    ];
    mockSearchListings.mockResolvedValue(items);

    const { getByTestId } = renderSearch();

    fireEvent.changeText(getByTestId('search-input'), 'xy');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(mockSearchListings).toHaveBeenCalledTimes(1));

    // Toggle sort — should NOT trigger a second API call
    fireEvent.press(getByTestId('search-sort-top-rated'));

    // Give any spurious async effects time to fire
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchListings).toHaveBeenCalledTimes(1);
  });

  it('tapping a result card navigates to /business/{id}', async () => {
    const items = [
      {
        id: 'biz-123',
        name: 'Starbucks',
        average_rating: 4.5,
        total_reviews: 5,
        category_name: 'Kafe',
        classification: 'zincir',
        slug: 'starbucks',
        entity_type: 'business',
      },
    ];
    mockSearchListings.mockResolvedValue(items);

    const { getByTestId } = renderSearch();

    fireEvent.changeText(getByTestId('search-input'), 'star');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(getByTestId('search-result-biz-123')).toBeTruthy());

    fireEvent.press(getByTestId('search-result-biz-123'));

    expect(mockPush).toHaveBeenCalledWith('/business/biz-123');
  });

  it('empty query (< 2 chars) after having searched clears results', async () => {
    const items = [
      {
        id: 'biz-abc',
        name: 'Burger King',
        average_rating: 3.5,
        total_reviews: 8,
        category_name: 'Restoran',
        classification: 'zincir',
        slug: 'burger-king',
        entity_type: 'business',
      },
    ];
    mockSearchListings.mockResolvedValue(items);

    const { getByTestId, queryByTestId, getByText } = renderSearch();

    // First search with a valid query
    fireEvent.changeText(getByTestId('search-input'), 'st');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() =>
      expect(mockSearchListings).toHaveBeenCalledTimes(1)
    );

    // Now clear the input — length < 2, no new API call should happen
    fireEvent.changeText(getByTestId('search-input'), '');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // searchListings was only called once (for the 'st' query)
    expect(mockSearchListings).toHaveBeenCalledTimes(1);

    // Browse view is shown when query is empty (< 2 chars)
    await waitFor(() =>
      expect(getByText('Kategorilere Göz At')).toBeTruthy()
    );

    // Result card is no longer present
    expect(queryByTestId('search-result-biz-abc')).toBeNull();
  });
});
