module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  // ratchet floor — raise as more screens get tested
  // Set ~5 points below actuals measured 2026-06-15:
  //   statements 33%, branches 34%, functions 26%, lines 33%
  coverageThreshold: {
    global: { branches: 29, functions: 21, lines: 28, statements: 28 },
    './src/config/legal.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
    './src/store/auth.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
};
