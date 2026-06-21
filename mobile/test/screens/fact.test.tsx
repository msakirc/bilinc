/**
 * ReportFactScreen component tests.
 * Asserts real behavior — not just rendering.
 * HONESTY RULES enforced: each test asserts a concrete observable outcome.
 *
 * FINDING: isSubmitDisabled in fact.tsx does NOT include a reputation check.
 * The formula is: !truthGuarantee || factStatement.trim().length === 0 ||
 *   selectedCategories.length === 0 || submitting
 * A user with rep<100 can still submit from the client — the server rejects
 * via RLS (error code 42501). Test 5 documents this gap explicitly.
 */
import React from 'react';
import { renderWithProviders, fireEvent, waitFor } from '../render';
import { aUser } from '../factories';
import ReportFactScreen from '../../app/business/[id]/fact';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockBack = jest.fn();
let mockSubmitFact = jest.fn();
let mockUser: any = aUser({ id: 'u1', reputation_score: 200 });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Supabase must be mocked before AppDataContext (via renderWithProviders) tries
// to create a real client — the env vars don't exist in jest.
jest.mock('@/src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: (resolve: (v: any) => any) => Promise.resolve({ data: [], error: null }).then(resolve),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
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
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: 'listing-123' }),
}));

jest.mock('@/src/store/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

jest.mock('@/src/services/database', () => ({
  DatabaseService: {
    submitFact: (...args: any[]) => mockSubmitFact(...args),
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
function renderScreen() {
  return renderWithProviders(<ReportFactScreen />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = aUser({ id: 'u1', reputation_score: 200 });
});

describe('ReportFactScreen', () => {
  it('tapping a category chip toggles selection — double-tap deselects it (leaving categories empty)', () => {
    const { getByTestId } = renderScreen();

    const safetyChip = getByTestId('fact-category-safety');

    // Toggle ON — now a category is selected
    fireEvent.press(safetyChip);

    // Toggle OFF — selectedCategories becomes [] again
    fireEvent.press(safetyChip);

    // With no category, truth guarantee, and statement: submit must still be disabled
    fireEvent.press(getByTestId('fact-truth-guarantee'));
    fireEvent.changeText(getByTestId('fact-statement'), 'Some statement');

    const submitBtn = getByTestId('fact-submit');
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(true);
  });

  it('submit is disabled when statement is empty (even with category + truth guarantee)', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('fact-category-safety'));
    fireEvent.press(getByTestId('fact-truth-guarantee'));
    // Do NOT fill statement

    const submitBtn = getByTestId('fact-submit');
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(true);
  });

  it('submit is disabled when no category selected (even with statement + truth guarantee)', () => {
    const { getByTestId } = renderScreen();

    fireEvent.changeText(getByTestId('fact-statement'), 'Test statement');
    fireEvent.press(getByTestId('fact-truth-guarantee'));
    // Do NOT select any category

    const submitBtn = getByTestId('fact-submit');
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(true);
  });

  it('submit is disabled when truth guarantee not checked (even with statement + category)', () => {
    const { getByTestId } = renderScreen();

    fireEvent.changeText(getByTestId('fact-statement'), 'Test statement');
    fireEvent.press(getByTestId('fact-category-safety'));
    // Do NOT press truth guarantee

    const submitBtn = getByTestId('fact-submit');
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(true);
  });

  it('submit is DISABLED when reputation_score < 100 (client-side guard)', () => {
    // CORRECT BEHAVIOR: The reputation notice banner is shown for rep<100,
    // and the submit button must also be disabled client-side — not just server-side RLS.
    mockUser = aUser({ id: 'u1', reputation_score: 10 });

    const { getByTestId } = renderScreen();

    fireEvent.changeText(getByTestId('fact-statement'), 'Test statement');
    fireEvent.press(getByTestId('fact-category-safety'));
    fireEvent.press(getByTestId('fact-truth-guarantee'));

    const submitBtn = getByTestId('fact-submit');
    // Client must block submit when reputation is below threshold.
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(true);
  });

  it('submit is ENABLED when reputation_score >= 100 (all conditions met)', () => {
    // Verify that rep>=100 users CAN submit when all other conditions are met.
    mockUser = aUser({ id: 'u1', reputation_score: 100 });

    const { getByTestId } = renderScreen();

    fireEvent.changeText(getByTestId('fact-statement'), 'Test statement');
    fireEvent.press(getByTestId('fact-category-safety'));
    fireEvent.press(getByTestId('fact-truth-guarantee'));

    const submitBtn = getByTestId('fact-submit');
    expect(
      submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled
    ).toBe(false);
  });

  it('submitting calls DatabaseService.submitFact with correct args', async () => {
    mockSubmitFact.mockResolvedValueOnce(undefined);

    const { getByTestId } = renderScreen();

    fireEvent.changeText(getByTestId('fact-statement'), 'Test fact');
    fireEvent.press(getByTestId('fact-category-safety'));
    fireEvent.press(getByTestId('fact-truth-guarantee'));
    fireEvent.press(getByTestId('fact-submit'));

    await waitFor(() =>
      expect(mockSubmitFact).toHaveBeenCalledWith({
        listingId: 'listing-123',
        statement: 'Test fact',
        category: 'safety',
        truthGuarantee: true,
      })
    );
  });

  it('statement maxLength is 300', () => {
    const { getByTestId } = renderScreen();

    const input = getByTestId('fact-statement');
    expect(input.props.maxLength).toBe(300);
  });
});
