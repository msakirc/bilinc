/**
 * Tests for the VideoCapture component.
 * Verifies: 3 ordered prompts render, liveness nonce renders,
 * a record control exists, and there is NO gallery/import button.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

// Mock useTheme
jest.mock('@/src/theme/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      text: '#000',
      textSecondary: '#555',
      textTertiary: '#999',
      primary: '#1B4D3E',
      border: '#eee',
    },
  }),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import VideoCapture from '../VideoCapture';

describe('VideoCapture', () => {
  const mockOnCaptured = jest.fn();
  const nonce = 'TEST-NONCE-42';

  const renderComponent = () =>
    render(<VideoCapture nonce={nonce} onCaptured={mockOnCaptured} />);

  // Text comes from i18n (t() is mocked to return keys here), so the 3 ordered
  // prompts are asserted by their stable testIDs rather than by translated text.
  it('renders 3 ordered video prompts', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('video-shot-1')).toBeTruthy();
    expect(getByTestId('video-shot-2')).toBeTruthy();
    expect(getByTestId('video-shot-3')).toBeTruthy();
  });

  it('renders the liveness nonce value on screen', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('liveness-nonce').props.children).toBe(nonce);
  });

  it('renders a record control (start/stop recording button)', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('record-button')).toBeTruthy();
  });

  it('does NOT render a pick-from-gallery button', () => {
    const { queryByTestId } = renderComponent();
    expect(queryByTestId('pick-from-gallery')).toBeNull();
  });
});
