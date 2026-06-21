/**
 * Login screen component tests.
 * Asserts real behavior — not just rendering.
 * HONESTY RULES enforced: each test asserts a concrete observable outcome.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor, act } from '@testing-library/react-native';
import { renderWithProviders } from '../render';
import LoginScreen from '../../app/(auth)/login';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSignIn = jest.fn();
const mockSetGuest = jest.fn();

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
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
}));

jest.mock('@/src/store/auth', () => ({
  useAuthStore: () => ({ signIn: mockSignIn }),
}));

// useGuest is exported from app/_layout — mock the whole module.
// The GuestContext in test/render.tsx provides the real value at render time,
// but the screen imports useGuest directly from @/app/_layout, so we mock it here.
jest.mock('@/app/_layout', () => ({
  useGuest: () => ({ isGuest: false, setGuest: mockSetGuest }),
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
function renderLogin() {
  return renderWithProviders(<LoginScreen />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('typing username and password then submitting calls signIn with those values', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);

    const { getByTestId } = renderLogin();

    fireEvent.changeText(getByTestId('login-username'), 'testuser');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('testuser', 'password123')
    );
  });

  it('submit button shows loading text while in-flight and is disabled', async () => {
    // Never resolves — keeps loading state active
    mockSignIn.mockReturnValueOnce(new Promise(() => {}));

    const { getByTestId, getByText } = renderLogin();

    fireEvent.changeText(getByTestId('login-username'), 'testuser');
    fireEvent.changeText(getByTestId('login-password'), 'password123');

    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    // Loading text replaces the default label
    expect(getByText('Giriş yapılıyor...')).toBeTruthy();

    // Button has disabled prop = true
    const submitButton = getByTestId('login-submit');
    expect(submitButton.props.accessibilityState?.disabled ?? submitButton.props.disabled).toBe(true);
  });

  it('empty username shows alert and does not call signIn', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = renderLogin();

    // Leave username empty, fill password only
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    fireEvent.press(getByTestId('login-submit'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('empty password shows alert and does not call signIn', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = renderLogin();

    // Fill username, leave password empty
    fireEvent.changeText(getByTestId('login-username'), 'testuser');
    fireEvent.press(getByTestId('login-submit'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('tapping register link navigates to /(auth)/register', () => {
    const { getByTestId } = renderLogin();

    fireEvent.press(getByTestId('login-register'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');
  });

  it('tapping forgot password navigates to /(auth)/reset-password', () => {
    const { getByTestId } = renderLogin();

    fireEvent.press(getByTestId('login-forgot'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/reset-password');
  });
});
