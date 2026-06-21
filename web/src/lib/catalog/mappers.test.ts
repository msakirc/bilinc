import { describe, it, expect } from "vitest";
import {
  searchResultFromCard,
  listingFromCard,
  listingFromCatalog,
} from "./mappers";
import type { CatalogListing, CatalogListingCard } from "./dynamodb";

const card = (over: Partial<CatalogListingCard> = {}): CatalogListingCard => ({
  id: "id-1",
  name: "Test Biz",
  slug: "test-biz",
  entityType: "business",
  cityCode: "34",
  rating: 4.2,
  totalReviews: 7,
  ...over,
});

describe("searchResultFromCard", () => {
  it("maps camelCase card -> snake_case SearchResult", () => {
    const r = searchResultFromCard(card());
    expect(r.id).toBe("id-1");
    expect(r.entity_type).toBe("business");
    expect(r.city_code).toBe("34");
    expect(r.average_rating).toBe(4.2);
    expect(r.total_reviews).toBe(7);
  });

  it("picks the primary photo, else the first", () => {
    expect(
      searchResultFromCard(card({ photos: [{ url: "a" }, { url: "b", primary: true }] }))
        .primary_photo_url,
    ).toBe("b");
    expect(
      searchResultFromCard(card({ photos: [{ url: "a" }, { url: "b" }] })).primary_photo_url,
    ).toBe("a");
    expect(searchResultFromCard(card({ photos: [] })).primary_photo_url).toBeUndefined();
    expect(searchResultFromCard(card()).primary_photo_url).toBeUndefined();
  });
});

describe("listingFromCard", () => {
  it("defaults status to active and carries entity_type", () => {
    const l = listingFromCard(card());
    expect(l.status).toBe("active");
    expect(l.entity_type).toBe("business");
    expect(l.average_rating).toBe(4.2);
  });
});

describe("listingFromCatalog", () => {
  const full = (over: Partial<CatalogListing> = {}): CatalogListing => ({
    id: "id-9",
    name: "Full Biz",
    slug: "full-biz",
    entityType: "business",
    status: "active",
    rating: 3,
    totalReviews: 2,
    createdAt: "2026-01-01",
    ...over,
  });

  it("maps every overlapping field", () => {
    const l = listingFromCatalog(full({ description: "d", cityCode: "06" }));
    expect(l.name).toBe("Full Biz");
    expect(l.description).toBe("d");
    expect(l.city_code).toBe("06");
    expect(l.entity_type).toBe("business");
  });

  it("derives category_slug from the primary category, else the first", () => {
    expect(
      listingFromCatalog(full({ categories: [{ slug: "a" }, { slug: "b", primary: true }] }))
        .category_slug,
    ).toBe("b");
    expect(
      listingFromCatalog(full({ categories: [{ slug: "a" }, { slug: "c" }] })).category_slug,
    ).toBe("a");
    expect(listingFromCatalog(full()).category_slug).toBeUndefined();
  });
});
