require('@testing-library/jest-native/extend-expect');

// Honesty guard: unit tests must never hit the real network.
global.fetch = jest.fn(() => {
  throw new Error('HONESTY GUARD: real network call in a unit test. Mock it.');
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// @expo/vector-icons transitively requires expo-asset which is unavailable in Jest.
// Stub the whole package globally so individual screen tests don't each re-declare it.
// Per-file overrides (e.g. reset-password.test.tsx) still take precedence over this.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// expo-location, image picker, etc. mocked per-test as needed.

// expo-localization has no native module under Jest; return a Turkish locale so
// i18n initialises to the default language (assertions expect Turkish strings).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'tr' }],
}));

// Initialise i18n once for the whole suite. Screens call useTranslation(); only
// app/_layout imports the init module at runtime, so tests rendering screens in
// isolation would otherwise get raw keys back from t(). Synchronous init.
require('./src/i18n');
