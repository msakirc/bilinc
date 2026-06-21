import { test, expect } from "@playwright/test";
import { ADMIN } from "./selectors";

// Content-sanity: the rest of the admin suite asserts structure (testIDs / URLs /
// roles / select values) and would stay green even if labels rendered as raw
// i18n keys, enum maps resolved to "undefined", or values were placeholders.
// This spec asserts the actual rendered TEXT on each admin page is clean.

// i18n namespaces (see CLAUDE.md). A leaked key renders like "admin:foo.bar".
const NS = "common|validation|errors|auth|home|business|fact|review|profile|activity|settings|search|category|admin|panel|legal|chrome";
const RAW_KEY = new RegExp(`\\b(${NS}):[a-zA-Z][a-zA-Z0-9_.]+`);

test.describe("admin content sanity", () => {
  test.skip(!process.env.E2E_ADMIN_USER, "needs admin session (E2E_ADMIN_USER)");

  for (const section of ADMIN.sections) {
    test(`${section.title}: no raw i18n keys / undefined leak`, async ({ page }) => {
      await page.goto(section.url);
      await expect(page.getByRole("heading", { name: section.title })).toBeVisible();
      // Let the table/cards finish (loading spinner gone).
      await page.waitForLoadState("networkidle").catch(() => {});

      const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
      expect(body, "raw i18n key leaked into rendered text").not.toMatch(RAW_KEY);
      expect(body, "literal 'undefined' rendered").not.toMatch(/\bundefined\b/);
      expect(body, "literal 'NaN' rendered").not.toMatch(/\bNaN\b/);
    });
  }

  test("dashboard stat labels are real text, not keys", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByTestId("admin-stats-grid")).toBeVisible();
    const grid = (await page.getByTestId("admin-stats-grid").innerText()).replace(/\s+/g, " ");
    expect(grid).not.toMatch(RAW_KEY);
    // Each card should carry a non-empty label beyond the numeric value.
    expect(grid.replace(/\d+/g, "").trim().length).toBeGreaterThan(20);
  });
});
