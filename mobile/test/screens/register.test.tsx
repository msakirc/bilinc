/**
 * RegisterScreen component tests.
 * HONESTY RULES: each test asserts a concrete observable outcome.
 *
 * Validation order in handleRegister (confirmed from source):
 *  1. Empty fields
 *  2. acceptTerms
 *  3. acceptKvkk
 *  4. usernameStatus !== 'available'  ← NOTE: before password checks
 *  5. password !== confirmPassword
 *  6. password.length < 8             ← LAST — after mismatch check
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { renderWithProviders } from '../render';
import RegisterScreen from '../../app/(auth)/register';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockSignUp = jest.fn();
let mockPush = jest.fn();
let mockBack = jest.fn();

// ---------------------------------------------------------------------------
// Supabase mock — controls username availability check result.
// Default: PGRST116 = no rows returned = username available.
// Variable must be prefixed with "mock" so Jest's babel plugin allows
// it inside jest.mock() factory closures.
// ---------------------------------------------------------------------------
let mockSingleResult: { data: any; error: any } = {
  data: null,
  error: { code: 'PGRST116' },
};

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@/src/store/auth', () => ({
  useAuthStore: () => ({ signUp: mockSignUp }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Ionicons — render nothing, avoids font loading issues in test env
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve(mockSingleResult)),
    })),
    rpc: jest.fn(),
    auth: { signInWithPassword: jest.fn(), signUp: jest.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Helper: render register screen
// ---------------------------------------------------------------------------
function renderRegister() {
  return renderWithProviders(<RegisterScreen />);
}

// ---------------------------------------------------------------------------
// Helper: fill all text fields
// ---------------------------------------------------------------------------
function fillFields(
  queries: ReturnType<typeof renderRegister>,
  {
    username = 'validuser',
    password = 'validpassword123',
    confirmPassword = 'validpassword123',
  }: { username?: string; password?: string; confirmPassword?: string } = {}
) {
  fireEvent.changeText(queries.getByTestId('register-username'), username);
  fireEvent.changeText(queries.getByTestId('register-password'), password);
  fireEvent.changeText(queries.getByTestId('register-confirm-password'), confirmPassword);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  // Reset supabase mock result to default (available)
  mockSingleResult = { data: null, error: { code: 'PGRST116' } };
  // Use fake timers to control the 500ms debounce
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RegisterScreen', () => {
  it('submit blocked when terms not checked — calls Alert not signUp', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const queries = renderRegister();

    // Fill all fields with valid values
    fillFields(queries);

    // Fire debounce timer so username check completes → status = 'available'
    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı kullanılabilir')).toBeTruthy()
    );

    // Check KVKK but NOT terms
    fireEvent.press(queries.getByTestId('register-kvkk-checkbox'));

    // Submit
    fireEvent.press(queries.getByTestId('register-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      expect.stringContaining('Kullanım Koşulları')
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submit blocked when KVKK not checked — calls Alert not signUp', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const queries = renderRegister();

    fillFields(queries);

    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı kullanılabilir')).toBeTruthy()
    );

    // Check terms but NOT KVKK
    fireEvent.press(queries.getByTestId('register-terms-checkbox'));

    fireEvent.press(queries.getByTestId('register-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      expect.stringContaining('açık rıza')
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('password shorter than 8 chars shows error and blocks signUp', async () => {
    // BEHAVIOR NOTE: password length is checked AFTER terms, KVKK, and
    // usernameStatus checks (see handleRegister lines 110-139). All three
    // must pass for the length guard to be reached. A 7-char password that
    // also has mismatched confirm-password will hit the mismatch alert first.
    // Use matching passwords here so only the length check triggers.
    const alertSpy = jest.spyOn(Alert, 'alert');
    const queries = renderRegister();

    fillFields(queries, { password: 'short12', confirmPassword: 'short12' });

    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı kullanılabilir')).toBeTruthy()
    );

    // Check both checkboxes so terms/kvkk guards pass
    fireEvent.press(queries.getByTestId('register-terms-checkbox'));
    fireEvent.press(queries.getByTestId('register-kvkk-checkbox'));

    fireEvent.press(queries.getByTestId('register-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      expect.stringContaining('8 karakter')
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('password confirm mismatch shows error and blocks signUp', async () => {
    // BEHAVIOR NOTE: mismatch is checked BEFORE length, so even if both
    // passwords are >= 8 chars, a mismatch fires first.
    const alertSpy = jest.spyOn(Alert, 'alert');
    const queries = renderRegister();

    fillFields(queries, {
      password: 'longpassword123',
      confirmPassword: 'different123',
    });

    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı kullanılabilir')).toBeTruthy()
    );

    fireEvent.press(queries.getByTestId('register-terms-checkbox'));
    fireEvent.press(queries.getByTestId('register-kvkk-checkbox'));

    fireEvent.press(queries.getByTestId('register-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      expect.stringContaining('eşleşmiyor')
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('valid form with both checkboxes checked calls signUp', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);

    const queries = renderRegister();

    fillFields(queries, {
      username: 'validuser',
      password: 'validpassword',
      confirmPassword: 'validpassword',
    });

    // Advance 500ms debounce so username availability resolves
    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı kullanılabilir')).toBeTruthy()
    );

    fireEvent.press(queries.getByTestId('register-terms-checkbox'));
    fireEvent.press(queries.getByTestId('register-kvkk-checkbox'));

    await act(async () => {
      fireEvent.press(queries.getByTestId('register-submit'));
    });

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith('validuser', 'validpassword')
    );
  });

  it('username taken status blocks submit with Alert', async () => {
    // Override mock to return an existing user row → 'taken' status
    mockSingleResult = { data: { username: 'takenuser' }, error: null };

    const alertSpy = jest.spyOn(Alert, 'alert');
    const queries = renderRegister();

    fillFields(queries, {
      username: 'takenuser',
      password: 'validpassword',
      confirmPassword: 'validpassword',
    });

    await act(async () => {
      jest.runAllTimers();
    });
    await waitFor(() =>
      expect(queries.queryByText('Kullanıcı adı zaten alınmış')).toBeTruthy()
    );

    fireEvent.press(queries.getByTestId('register-terms-checkbox'));
    fireEvent.press(queries.getByTestId('register-kvkk-checkbox'));

    fireEvent.press(queries.getByTestId('register-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      expect.stringContaining('zaten alınmış')
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
