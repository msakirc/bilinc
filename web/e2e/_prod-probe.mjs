// Throwaway: load the PROD CloudFront deploy in a real browser, screenshot the
// home + search, and dump console errors / failed requests / broken images.
// Run: node e2e/_prod-probe.mjs   (uses the chromium Playwright already installed)
import { chromium } from "@playwright/test";

const BASE = process.env.PROD_URL ?? "https://d1m2sila0rd5bv.cloudfront.net";
const out = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "tr-TR" });

const consoleErrors = [];
const failedReqs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) => failedReqs.push(`${r.failure()?.errorText} ${r.url()}`));
page.on("response", (r) => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });

async function shot(path, name) {
  consoleErrors.length = 0; failedReqs.length = 0;
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => out.push(`goto ${path} ERR ${e.message}`));
  await page.waitForTimeout(2500);
  const file = `e2e/_prod-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 }))
  );
  const brokenImgs = imgs.filter((i) => !i.ok);
  out.push(`\n### ${path} -> ${file}`);
  out.push(`images: ${imgs.length} total, ${brokenImgs.length} broken`);
  brokenImgs.slice(0, 8).forEach((i) => out.push(`  BROKEN IMG: ${i.src}`));
  out.push(`console errors (${consoleErrors.length}):`);
  [...new Set(consoleErrors)].slice(0, 12).forEach((e) => out.push("  " + e));
  out.push(`failed requests (${failedReqs.length}):`);
  [...new Set(failedReqs)].slice(0, 12).forEach((e) => out.push("  " + e));
}

await shot("/", "home");
await shot("/ara?q=ihlas", "search");
await browser.close();
console.log(out.join("\n"));
