/**
 * Crash reporting.
 *
 * Env-gated wrapper around @sentry/react-native. Crash reporting is enabled
 * ONLY when EXPO_PUBLIC_SENTRY_DSN is set (in .env locally, EAS secrets in
 * CI/build). With no DSN, init is a no-op and captureException falls back to
 * console.error — so local dev and contributors without a DSN are unaffected.
 *
 * Setup checklist (one-time):
 *   1. Create a project at sentry.io → React Native platform → copy the DSN.
 *   2. Set EXPO_PUBLIC_SENTRY_DSN in .env (and as an EAS secret for builds).
 *   3. (Optional, for readable stack traces) add SENTRY_ORG / SENTRY_PROJECT /
 *      SENTRY_AUTH_TOKEN as EAS secrets so the config plugin uploads sourcemaps.
 *
 * Wrapping: app/_layout.tsx exports `Sentry.wrap(RootLayout)` so the SDK can
 * instrument the root. captureException stays usable even when wrap is absent.
 */
import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

/**
 * Keys whose values may carry PII or secrets. Matched case-insensitively
 * against object keys in event.extra / event.contexts. Covers Bilinç-specific
 * sensitive fields (security-question answers, VKN/TCKN tax/national IDs,
 * signed document URLs) plus generic auth/contact identifiers.
 */
const PII_KEY_RE = /username|answer|vkn|tckn|document|token|phone|email/i;

/**
 * Recursively delete keys matching PII_KEY_RE from a plain object/array tree.
 * Mutates in place. Guards against cycles via a visited set and caps depth so
 * a pathological payload can never hang the beforeSend hook.
 */
function scrubPii(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): void {
  if (depth > 8 || value === null || typeof value !== 'object') return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) scrubPii(item, seen, depth + 1);
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (PII_KEY_RE.test(key)) {
      delete obj[key];
      continue;
    }
    scrubPii(obj[key], seen, depth + 1);
  }
}

/**
 * Strip personally-identifying data from a Sentry event before it leaves the
 * device. Exported for unit testing. Returns the (mutated) event, or null to
 * drop it entirely (we never drop — crash signal is the whole point).
 *
 * Scrubs:
 *   - event.user  → force-drop the client IP (Sentry attaches it server-side
 *     from the ingest connection unless ip_address is explicitly null).
 *   - event.request → headers/cookies/data may hold auth tokens or bodies.
 *   - event.extra / event.contexts → denylist scrub (see PII_KEY_RE).
 */
export function scrubEvent<T extends Record<string, any>>(event: T): T {
  // Force IP drop server-side and remove any client-set identity.
  // Cast: T is generic, so writing a not-statically-known key needs the index signature.
  (event as Record<string, any>).user = { ip_address: null };

  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }

  if (event.extra) scrubPii(event.extra);
  if (event.contexts) scrubPii(event.contexts);

  return event;
}

/**
 * Drop breadcrumbs that can leak data. console breadcrumbs echo log args;
 * http/xhr/fetch breadcrumbs carry full URLs — including signed document URLs
 * whose query string IS the credential. Returns null to drop the crumb.
 */
function scrubBreadcrumb(crumb: { category?: string; type?: string }): typeof crumb | null {
  const cat = crumb?.category ?? '';
  const type = crumb?.type ?? '';
  if (cat === 'console' || cat === 'http' || cat === 'xhr' || cat === 'fetch' || type === 'http') {
    return null;
  }
  return crumb;
}

/**
 * Initialise crash reporting. Safe to call once at app startup.
 * If EXPO_PUBLIC_SENTRY_DSN is not set this is a no-op.
 */
export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.log('[crashReporting] No EXPO_PUBLIC_SENTRY_DSN set — crash reporting disabled (no-op).');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // Native iOS/Android crash capture.
    enableNativeCrashHandling: true,
    // Performance tracing. Lower this if the free-tier span quota gets tight.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Tag events so dev/preview noise is easy to filter out in the dashboard.
    environment: __DEV__ ? 'development' : 'production',
    // Don't ship console-log breadcrumbs from dev to Sentry.
    enabled: !__DEV__ || !!SENTRY_DSN,
    // PII hardening — never attach IP / user identity by default.
    sendDefaultPii: false,
    // Last-chance client-side scrub of every error event.
    beforeSend: (event) => scrubEvent(event),
    // Transactions get the same scrub (request data, contexts).
    beforeSendTransaction: (event) => scrubEvent(event),
    // Drop console/http breadcrumbs that may leak URLs or logged secrets.
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });

  if (__DEV__) {
    console.log('[crashReporting] Sentry initialised.');
  }
}

/**
 * Report a caught exception. No-op-safe: falls back to console.error when no
 * DSN is configured. Called by the global ErrorBoundary.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
    return;
  }

  // Fallback so failures are never swallowed silently.
  console.error('[crashReporting] captureException:', error, context ?? '');
}
