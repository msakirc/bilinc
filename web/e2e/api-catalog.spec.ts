import { test, expect } from "@playwright/test";

// Integration tests for the same-origin catalog route handlers (the server-side
// DynamoDB/Lambda proxy layer). These assert the mapped response SHAPE — the
// boundary where the "entityType undefined -> entityType.undefined badge" bug
// originated. A shape assertion here catches it before any pixel renders.

const VALID_ENTITY = new Set(["business", "product", "brand"]);

test.describe("/api/catalog", () => {
  test("recent returns mapped listings, each with a valid entity_type", async ({ request }) => {
    const res = await request.get("/api/catalog/recent?type=business&limit=6");
    expect(res.ok()).toBe(true);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    test.skip(items.length === 0, "catalog empty on staging");
    for (const it of items) {
      expect(it.id, "listing missing id").toBeTruthy();
      expect(it.name, "listing missing name").toBeTruthy();
      // The regression: entity_type must be present and a known value, never
      // undefined (which rendered as the raw "entityType.undefined" badge).
      expect(VALID_ENTITY.has(it.entity_type), `bad entity_type ${it.entity_type}`).toBe(true);
    }
  });

  test("recent never serializes a literal undefined/null name", async ({ request }) => {
    const res = await request.get("/api/catalog/recent?limit=10");
    const items = await res.json();
    const raw = JSON.stringify(items);
    expect(raw).not.toContain('"name":null');
    expect(raw).not.toContain('"name":"undefined"');
  });

  test("search POST returns a JSON array", async ({ request }) => {
    const res = await request.post("/api/catalog/search", { data: { query: "ihlas", limit: 5 } });
    expect(res.ok()).toBe(true);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
  });

  test("search results carry a valid entity_type when present", async ({ request }) => {
    const res = await request.post("/api/catalog/search", { data: { query: "ihlas", limit: 10 } });
    const items = await res.json();
    test.skip(items.length === 0, "no search hits on staging");
    for (const it of items) {
      if (it.entity_type !== undefined) {
        expect(VALID_ENTITY.has(it.entity_type), `bad entity_type ${it.entity_type}`).toBe(true);
      }
    }
  });

  test("search GET is rejected (POST-only handler)", async ({ request }) => {
    const res = await request.get("/api/catalog/search?q=x");
    expect(res.status()).toBe(405);
  });

  test("suggest POST returns a JSON array", async ({ request }) => {
    const res = await request.post("/api/catalog/suggest", { data: { query: "ihl", limit: 5 } });
    expect(res.ok()).toBe(true);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
