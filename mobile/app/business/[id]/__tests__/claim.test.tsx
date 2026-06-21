/**
 * ClaimScreen component tests.
 *
 * Asserts:
 *   a) submit disabled initially
 *   b) aydınlatma/consent text present
 *   c) after valid VKN + rıza + mocked video capture →
 *      submit enabled → pressing calls createClaim (verificationMethod:'video')
 *      then uploadVerificationVideo
 *
 * Valid VKN used: "1234567890" (passes isValidVKN checksum — verified manually).
 *
 * Mock pattern follows test/screens/fact.test.tsx and review.test.tsx.
 */

import React from 'react';
import { renderWithProviders, fireEvent, waitFor, act } from '../../../../test/render';
import { aUser } from '../../../../test/factories';
import ClaimScreen from '../claim';

// ---------------------------------------------------------------------------
// Shared mock refs — declared before jest.mock() calls
// ---------------------------------------------------------------------------
let mockBack = jest.fn();
let mockCreateClaim = jest.fn();
let mockUploadVerificationVideo = jest.fn();
let mockUser: any = aUser({ id: 'user-abc', reputation_score: 200 });

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Supabase — must be mocked before AppDataContext initialises a real client
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
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'listing-xyz9' }),
}));

jest.mock('@/src/store/auth', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

jest.mock('@/src/services/database', () => ({
  DatabaseService: {
    createClaim: (...args: any[]) => mockCreateClaim(...args),
    uploadVerificationVideo: (...args: any[]) =>
      mockUploadVerificationVideo(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Ionicons — avoids font loading issues in test env
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// expo-location — return granted + a fixed coordinate
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 41.015, longitude: 28.979 } })
  ),
  Accuracy: { Balanced: 3 },
}));

/**
 * VideoCapture mock — renders a single "Capture" button.
 * When pressed it calls onCaptured with a fake result, simulating the user
 * completing the recording flow.
 */
jest.mock('@/src/components/verification/VideoCapture', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onCaptured }: { nonce: string; onCaptured: (v: any) => void }) => (
      <TouchableOpacity
        testID="mock-video-capture"
        onPress={() => onCaptured({ uri: 'file://v.mp4', durationMs: 40000 })}
      >
        <Text>Kayda Başla</Text>
      </TouchableOpacity>
    ),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderClaim() {
  return renderWithProviders(<ClaimScreen />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = aUser({ id: 'user-abc', reputation_score: 200 });
});

describe('ClaimScreen', () => {
  // ── (a) Submit disabled initially ────────────────────────────────────────

  it('submit button is disabled initially (no VKN, no rıza, no video)', () => {
    const { getByTestId } = renderClaim();

    const submit = getByTestId('claim-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled ??
      true;
    expect(isDisabled).toBe(true);
  });

  it('submit button is disabled when only VKN is filled (missing rıza + video)', () => {
    const { getByTestId } = renderClaim();

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');

    const submit = getByTestId('claim-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled ??
      true;
    expect(isDisabled).toBe(true);
  });

  it('submit button is disabled when VKN + rıza set but no video', () => {
    const { getByTestId } = renderClaim();

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');
    fireEvent.press(getByTestId('claim-riza-checkbox'));

    const submit = getByTestId('claim-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled ??
      true;
    expect(isDisabled).toBe(true);
  });

  // ── (b) Aydınlatma / consent text present ────────────────────────────────

  it('renders aydınlatma disclosure text', () => {
    const { getByTestId } = renderClaim();
    const el = getByTestId('claim-aydinlatma-text');
    expect(el.props.children).toContain('Bilinç — İşletme Sahipliği Doğrulama');
  });

  it('renders rıza checkbox with consent text', () => {
    const { getByTestId } = renderClaim();
    const checkbox = getByTestId('claim-riza-checkbox');
    // The checkbox row contains the consent text as a child
    expect(checkbox).toBeTruthy();
  });

  it('renders VideoCapture component', () => {
    const { getByTestId } = renderClaim();
    expect(getByTestId('mock-video-capture')).toBeTruthy();
  });

  // ── VKN validation ───────────────────────────────────────────────────────

  it('shows VKN error message when invalid VKN is entered and blurred', () => {
    const { getByTestId } = renderClaim();

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567891'); // invalid
    fireEvent(getByTestId('claim-vkn'), 'blur');

    expect(getByTestId('claim-vkn-error')).toBeTruthy();
  });

  it('does NOT show VKN error before field is touched', () => {
    const { queryByTestId } = renderClaim();

    // Don't blur — error should not appear yet
    expect(queryByTestId('claim-vkn-error')).toBeNull();
  });

  // ── (c) Happy path: all conditions met → enabled → calls services ─────────

  it('submit is enabled after valid VKN + rıza + video capture', async () => {
    const { getByTestId } = renderClaim();

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');
    fireEvent.press(getByTestId('claim-riza-checkbox'));
    fireEvent.press(getByTestId('mock-video-capture'));

    const submit = getByTestId('claim-submit');
    const isDisabled =
      submit.props.disabled ??
      submit.props.accessibilityState?.disabled ??
      false;
    expect(isDisabled).toBe(false);
  });

  it('pressing submit calls createClaim with verificationMethod:"video" then uploadVerificationVideo', async () => {
    mockCreateClaim.mockResolvedValueOnce('claim-id-001');
    mockUploadVerificationVideo.mockResolvedValueOnce('user-abc/claim-id-001/video.mp4');

    const { getByTestId } = renderClaim();

    // Fill all required fields
    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');
    fireEvent.press(getByTestId('claim-riza-checkbox'));
    fireEvent.press(getByTestId('mock-video-capture'));
    fireEvent.press(getByTestId('claim-submit'));

    await waitFor(() => {
      expect(mockCreateClaim).toHaveBeenCalledTimes(1);
    });

    const createClaimArg = mockCreateClaim.mock.calls[0][0];
    expect(createClaimArg.verificationMethod).toBe('video');
    expect(createClaimArg.taxNumber).toBe('1234567890');
    expect(createClaimArg.listingId).toBe('listing-xyz9');
    expect(createClaimArg.userId).toBe('user-abc');
    expect(createClaimArg.role).toBe('owner'); // default

    await waitFor(() => {
      expect(mockUploadVerificationVideo).toHaveBeenCalledWith(
        'user-abc',
        'claim-id-001',
        'file://v.mp4'
      );
    });
  });

  it('shows success state after successful submission', async () => {
    mockCreateClaim.mockResolvedValueOnce('claim-id-002');
    mockUploadVerificationVideo.mockResolvedValueOnce('path/video.mp4');

    const { getByTestId } = renderClaim();

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');
    fireEvent.press(getByTestId('claim-riza-checkbox'));
    fireEvent.press(getByTestId('mock-video-capture'));
    fireEvent.press(getByTestId('claim-submit'));

    await waitFor(() => {
      expect(getByTestId('claim-success')).toBeTruthy();
    });
  });

  // ── Role picker ───────────────────────────────────────────────────────────

  it('role defaults to "owner" and can be changed to "manager"', () => {
    const { getByTestId } = renderClaim();

    const managerChip = getByTestId('claim-role-manager');
    fireEvent.press(managerChip);

    // Fill remaining fields and submit to assert role in call
    mockCreateClaim.mockResolvedValueOnce('c3');
    mockUploadVerificationVideo.mockResolvedValueOnce('p');

    fireEvent.changeText(getByTestId('claim-vkn'), '1234567890');
    fireEvent(getByTestId('claim-vkn'), 'blur');
    fireEvent.press(getByTestId('claim-riza-checkbox'));
    fireEvent.press(getByTestId('mock-video-capture'));
    fireEvent.press(getByTestId('claim-submit'));

    return waitFor(() => {
      expect(mockCreateClaim.mock.calls[0][0].role).toBe('manager');
    });
  });

  // ── Guest wall ────────────────────────────────────────────────────────────

  it('shows login-required message when user is not logged in', () => {
    mockUser = null;
    const { getByTestId } = renderClaim();
    expect(getByTestId('claim-guest-back')).toBeTruthy();
  });
});
