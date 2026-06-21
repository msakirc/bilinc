/**
 * Component tests for app/(auth)/reset-password.tsx
 *
 * Covers all 3 wizard steps:
 *   step 1 'username'    → get_security_questions RPC
 *   step 2 'questions'   → verify_security_answers RPC
 *   step 3 'newPassword' → reset_password_with_token RPC
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../render';
import ResetPasswordScreen from '../../app/(auth)/reset-password';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockBack = jest.fn();
let mockReplace = jest.fn();
let mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

// @expo/vector-icons transitively requires expo-asset which is unavailable in Jest.
// Stub the whole package with a no-op component.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props: any) => React.createElement(Text, null, props.name ?? '');
  return {
    Ionicons: Icon,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: (...args: any[]) => mockRpc(...args),
    auth: {},
  },
}));

// ---------------------------------------------------------------------------
// Shared RPC fixture data
// ---------------------------------------------------------------------------
const QUESTIONS_DATA = [
  { question_1: 'Evcil hayvanınızın adı?', question_2: 'Doğduğunuz şehir?' },
];

const VERIFY_DATA = [{ success: true, reset_token: 'tok123' }];

const RESET_DATA = [{ success: true }];

// ---------------------------------------------------------------------------
// Helper: advance to step 2 (questions) starting from fresh render
// ---------------------------------------------------------------------------
async function advanceToStep2(getByTestId: (id: string) => any) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_security_questions') {
      return Promise.resolve({ data: QUESTIONS_DATA, error: null });
    }
    return Promise.resolve({ data: null, error: { message: 'unexpected call' } });
  });

  fireEvent.changeText(getByTestId('reset-username'), 'testuser');
  fireEvent.press(getByTestId('reset-step1-submit'));

  await waitFor(() => getByTestId('reset-step2-submit'));
}

// ---------------------------------------------------------------------------
// Helper: advance to step 3 (newPassword) from a fresh render
// ---------------------------------------------------------------------------
async function advanceToStep3(getByTestId: (id: string) => any) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_security_questions') {
      return Promise.resolve({ data: QUESTIONS_DATA, error: null });
    }
    if (fn === 'verify_security_answers') {
      return Promise.resolve({ data: VERIFY_DATA, error: null });
    }
    return Promise.resolve({ data: null, error: { message: 'unexpected call' } });
  });

  // Step 1
  fireEvent.changeText(getByTestId('reset-username'), 'testuser');
  fireEvent.press(getByTestId('reset-step1-submit'));
  await waitFor(() => getByTestId('reset-step2-submit'));

  // Step 2
  fireEvent.changeText(getByTestId('reset-answer-0'), 'cevap1');
  fireEvent.changeText(getByTestId('reset-answer-1'), 'cevap2');
  fireEvent.press(getByTestId('reset-step2-submit'));
  await waitFor(() => getByTestId('reset-step3-submit'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ResetPasswordScreen', () => {
  // -------------------------------------------------------------------------
  // Test 1
  // -------------------------------------------------------------------------
  it('step 1: entering username and pressing Devam calls get_security_questions RPC', async () => {
    mockRpc.mockResolvedValue({ data: QUESTIONS_DATA, error: null });

    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(getByTestId('reset-username'), 'testuser');
    fireEvent.press(getByTestId('reset-step1-submit'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('get_security_questions', {
        p_username: 'testuser',
      })
    );
  });

  // -------------------------------------------------------------------------
  // Test 2
  // -------------------------------------------------------------------------
  it('step 1 → step 2 transition: questions appear after successful RPC', async () => {
    mockRpc.mockResolvedValue({ data: QUESTIONS_DATA, error: null });

    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(getByTestId('reset-username'), 'testuser');
    fireEvent.press(getByTestId('reset-step1-submit'));

    // Cevapları Doğrula button only exists in step 2
    await waitFor(() => getByTestId('reset-step2-submit'));
  });

  // -------------------------------------------------------------------------
  // Test 3
  // -------------------------------------------------------------------------
  it('step 2: filling answers and pressing Doğrula calls verify_security_answers', async () => {
    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    await advanceToStep2(getByTestId);

    // Now set up the step-2 RPC mock
    mockRpc.mockResolvedValue({ data: VERIFY_DATA, error: null });

    fireEvent.changeText(getByTestId('reset-answer-0'), 'cevap1');
    fireEvent.changeText(getByTestId('reset-answer-1'), 'cevap2');
    fireEvent.press(getByTestId('reset-step2-submit'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('verify_security_answers', {
        p_username: 'testuser',
        p_answer_1: 'cevap1',
        p_answer_2: 'cevap2',
      })
    );
  });

  // -------------------------------------------------------------------------
  // Test 4
  // -------------------------------------------------------------------------
  it('step 2 → step 3 transition: new password form appears after successful verify', async () => {
    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    await advanceToStep3(getByTestId);

    // Şifreyi Sıfırla button only exists in step 3
    expect(getByTestId('reset-step3-submit')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 5
  // -------------------------------------------------------------------------
  it('step 3: password shorter than 8 chars shows Alert and does NOT call reset RPC', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    await advanceToStep3(getByTestId);

    // Clear call count so we only count step-3 calls
    mockRpc.mockClear();

    fireEvent.changeText(getByTestId('reset-new-password'), 'short');
    fireEvent.changeText(getByTestId('reset-confirm-password'), 'short');
    fireEvent.press(getByTestId('reset-step3-submit'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Hata',
      'Şifre en az 8 karakter olmalıdır.'
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      'reset_password_with_token',
      expect.anything()
    );
  });

  // -------------------------------------------------------------------------
  // Test 6
  // -------------------------------------------------------------------------
  it('step 3: valid password calls reset_password_with_token with correct args', async () => {
    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    // advanceToStep3 sets up mocks for steps 1 and 2; configure step 3 mock
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_security_questions') {
        return Promise.resolve({ data: QUESTIONS_DATA, error: null });
      }
      if (fn === 'verify_security_answers') {
        return Promise.resolve({ data: VERIFY_DATA, error: null });
      }
      if (fn === 'reset_password_with_token') {
        return Promise.resolve({ data: RESET_DATA, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Step 1
    fireEvent.changeText(getByTestId('reset-username'), 'testuser');
    fireEvent.press(getByTestId('reset-step1-submit'));
    await waitFor(() => getByTestId('reset-step2-submit'));

    // Step 2
    fireEvent.changeText(getByTestId('reset-answer-0'), 'cevap1');
    fireEvent.changeText(getByTestId('reset-answer-1'), 'cevap2');
    fireEvent.press(getByTestId('reset-step2-submit'));
    await waitFor(() => getByTestId('reset-step3-submit'));

    // Step 3
    fireEvent.changeText(getByTestId('reset-new-password'), 'newpassword123');
    fireEvent.changeText(getByTestId('reset-confirm-password'), 'newpassword123');
    fireEvent.press(getByTestId('reset-step3-submit'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith(
        'reset_password_with_token',
        expect.objectContaining({
          p_username: 'testuser',
          p_new_password: 'newpassword123',
        })
      )
    );
  });

  // -------------------------------------------------------------------------
  // Test 7
  // -------------------------------------------------------------------------
  it('step 2 back button goes to step 1', async () => {
    const { getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    await advanceToStep2(getByTestId);

    fireEvent.press(getByTestId('reset-step2-back'));

    // After going back, step-1 submit button must be visible again
    await waitFor(() => getByTestId('reset-step1-submit'));
  });
});
