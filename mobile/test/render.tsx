/**
 * renderWithProviders — wraps a component in the same provider stack
 * that the real app uses: ThemeProvider + AppDataProvider + a local
 * GuestContext stub.
 *
 * Import paths verified against source:
 *   ThemeProvider  → src/theme/ThemeContext.tsx
 *   AppDataProvider → src/contexts/AppDataContext.tsx
 *   GuestContext   → defined inline here (not exported from app/_layout.tsx)
 */
import React, { createContext, useContext, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { AppDataProvider } from '../src/contexts/AppDataContext';

// ---------------------------------------------------------------------------
// Guest context stub — mirrors the shape in app/_layout.tsx
// ---------------------------------------------------------------------------
export interface GuestContextValue {
  isGuest: boolean;
  setGuest: (v: boolean) => void;
}

export const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  setGuest: () => {},
});

export const useGuest = () => useContext(GuestContext);

// ---------------------------------------------------------------------------
// Provider wrapper
// ---------------------------------------------------------------------------
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  isGuest?: boolean;
}

function AllProviders({
  children,
  isGuest = false,
}: {
  children: ReactNode;
  isGuest?: boolean;
}) {
  return (
    <GuestContext.Provider value={{ isGuest, setGuest: () => {} }}>
      <ThemeProvider>
        <AppDataProvider>{children}</AppDataProvider>
      </ThemeProvider>
    </GuestContext.Provider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  { isGuest = false, ...options }: RenderWithProvidersOptions = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders isGuest={isGuest}>{children}</AllProviders>
    ),
    ...options,
  });
}

// Re-export everything from RTL so tests can import from one place
export * from '@testing-library/react-native';
