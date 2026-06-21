/**
 * WriteReviewScreen component tests.
 * Covers: star rating, submit disabled logic, submit call args, maxLength, guest wall.
 * HONESTY RULES enforced: every assertion reflects real, observable behaviour.
 */
import React from 'react';
import { renderWithProviders, fireEvent, waitFor } from '../render';
import { aUser } from '../factories';
import WriteReviewScreen from '../../app/business/[id]/review';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockBack = jest.fn();
let mockPush = jest.fn();
let mockSubmitReview = jest.fn();

// The auth mock reads mockUser at call time so it can be reassigned per-test.
let mockUser: any = aUser({ id: 'u1', reputation_score: 200 });

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
    submitReview: (...args: any[]) => mockSubmitReview(...args),
    uploadReviewPhotos: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
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
function renderReview() {
  return renderWithProviders(<WriteReviewScreen />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  // Reset mockUser to a logged-in user before each test
  mockUser = aUser({ id: 'u1', reputation_score: 200 });
});

describe('WriteReviewScreen', () => {
  it('tapping star 3 sets rating to 3 and shows label İdare Eder', () => {
    const { getByTestId, getByText } = renderReview();

    fireEvent.press(getByTestId('review-star-3'));

    expect(getByText('İdare Eder')).toBeTruthy();
  });

  it('submit button is disabled when rating=0 and text is empty', () => {
    const { getByTestId } = renderReview();

    const submit = getByTestId('review-submit');
    // TouchableOpacity exposes disabled via props.disabled or accessibilityState.disabled
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled;
    expect(isDisabled).toBe(true);
  });

  it('submit button is disabled when rating>0 but text is empty', () => {
    const { getByTestId } = renderReview();

    fireEvent.press(getByTestId('review-star-4'));

    const submit = getByTestId('review-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled;
    expect(isDisabled).toBe(true);
  });

  it('submit button is enabled when rating>0 AND text non-empty', () => {
    const { getByTestId } = renderReview();

    fireEvent.press(getByTestId('review-star-4'));
    fireEvent.changeText(getByTestId('review-text'), 'Great place!');

    const submit = getByTestId('review-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled ??
      false;
    expect(isDisabled).toBe(false);
  });

  it('submitting calls DatabaseService.submitReview with correct listingId, rating, content', async () => {
    mockSubmitReview.mockResolvedValueOnce({ id: 'r1' });

    const { getByTestId } = renderReview();

    fireEvent.press(getByTestId('review-star-4'));
    fireEvent.changeText(getByTestId('review-text'), 'Great place!');
    fireEvent.press(getByTestId('review-submit'));

    await waitFor(() =>
      expect(mockSubmitReview).toHaveBeenCalledWith({
        listingId: 'listing-123',
        rating: 4,
        content: 'Great place!',
      })
    );
  });

  it('text input enforces 500 char maxLength via prop', () => {
    // BEHAVIOR NOTE: MAX_CHARS=500 is enforced by TextInput's maxLength prop,
    // not by JS trimming in handleSubmit. We assert the prop value directly.
    const { getByTestId } = renderReview();

    const input = getByTestId('review-text');
    expect(input.props.maxLength).toBe(500);
  });

  describe('guest user (no user)', () => {
    it('sees login-required message when not logged in', () => {
      mockUser = null;

      const { getByText } = renderReview();

      expect(getByText('Giriş Yapmanız Gerekiyor')).toBeTruthy();
    });

    it('guest back button is present and calls router.back', () => {
      mockUser = null;

      const { getByTestId } = renderReview();

      fireEvent.press(getByTestId('review-guest-back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
