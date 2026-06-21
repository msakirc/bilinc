import { test, expect } from "@playwright/test";
import { TR } from "./selectors";
import { login, PLACEHOLDER_ID } from "./helpers";

// Mirrors mobile .maestro/05-fact-rep-gate.yaml. The fact form is gated on
// reputation_score >= 100; below that the page shows a reputation block instead
// of the form. Logs in as the low-rep seed user, so it lives in the guest
// project. The gate depends only on the user, not on the listing.

const FACT_URL = `/isletme/${PLACEHOLDER_ID}/bilgi-ekle`;

test.describe("fact reputation gate", () => {
  test("low-rep user (<100) sees the reputation gate, not the form", async ({ page }) => {
    test.skip(!process.env.E2E_LOWREP_USER, "needs low-rep seed user (E2E_LOWREP_USER)");
    await login(page, process.env.E2E_LOWREP_USER!, process.env.E2E_LOWREP_PASS!);
    await page.goto(FACT_URL);
    await expect(page.getByText(TR.factLowRepTitle)).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });
});
