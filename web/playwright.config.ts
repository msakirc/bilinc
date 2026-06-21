import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Web E2E — Playwright is the web counterpart of the mobile Maestro suite.
// Run: npm run test:e2e   (headless, boots Next itself via webServer below)
//      npm run test:e2e:ui   (Playwright UI mode for debugging)
//      npm run test:e2e:codegen   (record a new flow)

// Load e2e/.env.e2e (gitignored) into process.env without a dotenv dependency.
// Holds the STAGING Supabase creds + seed user so the app boots against a live
// (not paused) project and the auth/guest-gate flows work. See .env.e2e.example.
try {
  const raw = readFileSync(resolve(__dirname, "e2e/.env.e2e"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no local env file — rely on real environment (CI secrets)
}

const PORT = 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Next dev compiles routes on-demand; too many parallel cold navigations
  // starve the single dev server. Cap workers and give cold compiles room.
  workers: process.env.CI ? 1 : 2,
  timeout: 120_000,
  // Cold Next-dev route compilation + staging round-trips can exceed the 5s
  // default on first hit; give assertions room under local parallel load.
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "tr-TR",
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Logs in once, saves session to e2e/.auth/user.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Logs in the ADMIN user once, saves session to e2e/.auth/admin.json.
    { name: "admin-setup", testMatch: /auth\.admin\.setup\.ts/ },
    // Guest flows (no session). Everything except setups + *.authed/*.admin specs.
    {
      name: "guest",
      testIgnore: [
        /auth\.setup\.ts/,
        /auth\.admin\.setup\.ts/,
        /\.authed\.spec\.ts/,
        /\.admin\.spec\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    // Authenticated flows — reuse the saved session, no per-test login.
    {
      name: "authed",
      testMatch: /\.authed\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
    // Admin-panel flows — reuse the admin session (user_type === "admin").
    {
      name: "admin",
      testMatch: /\.admin\.spec\.ts/,
      dependencies: ["admin-setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
    },
  ],
  // If E2E_BASE_URL is set (e.g. staging), don't boot a server — test that URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // dev locally (fast reload); build+start in CI (production parity).
        command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
        url: BASE_URL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        // Force the app onto the E2E (staging) Supabase + AWS catalog/search,
        // overriding .env.local.
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION ?? "",
          NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID ?? "",
          NEXT_PUBLIC_DYNAMODB_TABLE: process.env.NEXT_PUBLIC_DYNAMODB_TABLE ?? "",
          NEXT_PUBLIC_SEARCH_URL: process.env.NEXT_PUBLIC_SEARCH_URL ?? "",
        },
      },
});
