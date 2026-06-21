/**
 * Service unit tests for src/services/crashReporting.ts
 * Covers: initCrashReporting, captureException.
 *
 * Key behaviors under test:
 *   - initCrashReporting() is a no-op when EXPO_PUBLIC_SENTRY_DSN is not set
 *   - captureException() falls back to console.error when not initialized (no DSN)
 *   - captureException() calls Sentry.captureException when DSN is set
 *   - initCrashReporting() calls Sentry.init when DSN is set
 *   - initCrashReporting() is idempotent (subsequent calls are ignored via `initialized` flag)
 *
 * IMPORTANT: This module caches two module-level values at import time:
 *   const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN  (captured once on module load)
 *   let initialized = false                                  (reset only by re-requiring)
 *
 * To test different DSN states, we use jest.isolateModules() to get a fresh module
 * instance per test suite so the cached values are re-evaluated.
 */

// @sentry/react-native is mocked globally so it never imports native code
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: jest.fn((c: any) => c),
}));

// ---------------------------------------------------------------------------
// Suite: No DSN set (no-op paths)
// ---------------------------------------------------------------------------

describe('crashReporting — no EXPO_PUBLIC_SENTRY_DSN', () => {
  let initCrashReporting: () => void;
  let captureException: (error: unknown, context?: Record<string, unknown>) => void;
  let Sentry: any;

  beforeEach(() => {
    // Ensure DSN is unset for this suite
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;

    jest.isolateModules(() => {
      Sentry = require('@sentry/react-native');
      const mod = require('../crashReporting');
      initCrashReporting = mod.initCrashReporting;
      captureException = mod.captureException;
    });

    // Reset Sentry mocks after isolation
    jest.clearAllMocks();
  });

  it('initCrashReporting() does NOT call Sentry.init when DSN is unset', () => {
    initCrashReporting();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initCrashReporting() is a no-op (does not throw) when DSN is unset', () => {
    expect(() => initCrashReporting()).not.toThrow();
  });

  it('captureException() falls back to console.error when DSN is unset', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('test error');

    captureException(err);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[crashReporting] captureException:',
      err,
      ''
    );
    consoleSpy.mockRestore();
  });

  it('captureException() passes context to console.error when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('ctx error');
    const ctx = { userId: 'u1', screen: 'HomeScreen' };

    captureException(err, ctx);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[crashReporting] captureException:',
      err,
      ctx
    );
    consoleSpy.mockRestore();
  });

  it('captureException() does NOT call Sentry.captureException when DSN is unset', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    captureException(new Error('no sentry'));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('captureException() does not throw when called with a non-Error value (string)', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => captureException('something bad')).not.toThrow();

    jest.restoreAllMocks();
  });

  it('captureException() does not throw when called with undefined', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => captureException(undefined)).not.toThrow();

    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Suite: DSN is set — Sentry active paths
// ---------------------------------------------------------------------------

describe('crashReporting — EXPO_PUBLIC_SENTRY_DSN is set', () => {
  let initCrashReporting: () => void;
  let captureException: (error: unknown, context?: Record<string, unknown>) => void;
  let Sentry: any;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@o123.ingest.sentry.io/456';

    jest.isolateModules(() => {
      Sentry = require('@sentry/react-native');
      const mod = require('../crashReporting');
      initCrashReporting = mod.initCrashReporting;
      captureException = mod.captureException;
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('initCrashReporting() calls Sentry.init with the DSN', () => {
    initCrashReporting();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initArg.dsn).toBe('https://public@o123.ingest.sentry.io/456');
  });

  it('initCrashReporting() enables native crash handling', () => {
    initCrashReporting();

    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initArg.enableNativeCrashHandling).toBe(true);
  });

  it('initCrashReporting() disables sendDefaultPii', () => {
    initCrashReporting();

    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initArg.sendDefaultPii).toBe(false);
  });

  it('beforeSend strips a planted IP address and extra.username', () => {
    initCrashReporting();

    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0];
    const event = {
      user: { id: 'u1', ip_address: '203.0.113.7', email: 'a@b.com' },
      extra: { username: 'sakir', screen: 'HomeScreen' },
      contexts: { auth: { token: 'secret-jwt' } },
      request: { headers: { Authorization: 'Bearer x' }, data: { vkn: '123' } },
    };

    const scrubbed = initArg.beforeSend(event);

    // IP forced to null, identity removed.
    expect(scrubbed.user).toEqual({ ip_address: null });
    // Denylisted extra key gone, benign key kept.
    expect(scrubbed.extra.username).toBeUndefined();
    expect(scrubbed.extra.screen).toBe('HomeScreen');
    // Nested token scrubbed from contexts.
    expect(scrubbed.contexts.auth.token).toBeUndefined();
    // Request payload stripped.
    expect(scrubbed.request.headers).toBeUndefined();
    expect(scrubbed.request.data).toBeUndefined();
  });

  it('beforeBreadcrumb drops console and http breadcrumbs', () => {
    initCrashReporting();

    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initArg.beforeBreadcrumb({ category: 'console' })).toBeNull();
    expect(initArg.beforeBreadcrumb({ category: 'http' })).toBeNull();
    expect(initArg.beforeBreadcrumb({ type: 'http' })).toBeNull();
    // Navigation breadcrumbs (no URL/secret) are kept.
    const nav = { category: 'navigation' };
    expect(initArg.beforeBreadcrumb(nav)).toBe(nav);
  });

  it('captureException() calls Sentry.captureException with the error', () => {
    // captureException uses module-level SENTRY_DSN to decide path, not initialized flag
    const err = new Error('boom');

    captureException(err);

    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
  });

  it('captureException() passes context as { extra: context } to Sentry', () => {
    const err = new Error('ctx boom');
    const ctx = { userId: 'u2', action: 'submitFact' };

    captureException(err, ctx);

    expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: ctx });
  });

  it('captureException() does NOT fall back to console.error when DSN is set', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    captureException(new Error('sentry test'));

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Suite: idempotency — initCrashReporting called multiple times
// ---------------------------------------------------------------------------

describe('crashReporting — initCrashReporting idempotency', () => {
  let initCrashReporting: () => void;
  let Sentry: any;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@o123.ingest.sentry.io/456';

    jest.isolateModules(() => {
      Sentry = require('@sentry/react-native');
      const mod = require('../crashReporting');
      initCrashReporting = mod.initCrashReporting;
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('calls Sentry.init exactly once even when initCrashReporting is called multiple times', () => {
    // BEHAVIOR NOTE: The `initialized` module-level flag prevents double-init.
    // This guards against the app calling initCrashReporting() in multiple places.
    initCrashReporting();
    initCrashReporting();
    initCrashReporting();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });
});
