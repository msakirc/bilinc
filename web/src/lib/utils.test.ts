import { describe, it, expect } from "vitest";
import {
  formatDate, formatRelativeDate, credibilityLabel, verificationLabel,
  entityTypeLabel, factCategoryLabel, claimStatusLabel, reviewStatusLabel,
} from "./utils";

describe("label maps", () => {
  const cases: Array<[(s: string) => string, Record<string, string>]> = [
    [credibilityLabel, { novice: "Yeni Uye", contributor: "Katilimci", trusted: "Guvenilir", expert: "Uzman" }],
    [verificationLabel, { pending: "Beklemede", verified: "Dogrulanmis", disputed: "Tartismali", needs_review: "Inceleme Gerekli", retracted: "Geri Cekilmis" }],
    [entityTypeLabel, { business: "Isletme", product: "Urun", brand: "Marka" }],
    [factCategoryLabel, { safety: "Guvenlik", health: "Saglik", quality: "Kalite", legal: "Hukuki", environmental: "Cevre", abuse: "Istismar", labor: "Calisma Haklari", other: "Diger" }],
    [claimStatusLabel, { pending: "Beklemede", verified: "Dogrulanmis", rejected: "Reddedildi", revoked: "Iptal Edildi", expired: "Suresi Doldu" }],
    [reviewStatusLabel, { active: "Aktif", hidden: "Gizli", removed: "Kaldirildi" }],
  ];

  for (const [fn, map] of cases) {
    for (const [key, label] of Object.entries(map)) {
      it(`${fn.name}(${key}) -> ${label}`, () => expect(fn(key)).toBe(label));
    }
    it(`${fn.name} passes an unknown key through unchanged`, () => {
      expect(fn("__nope__")).toBe("__nope__");
    });
    it(`${fn.name} never returns undefined/empty for known keys`, () => {
      for (const key of Object.keys(map)) {
        expect(fn(key)).toBeTruthy();
      }
    });
  }
});

describe("formatRelativeDate", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it("< 1 min -> az once", () => expect(formatRelativeDate(ago(10_000))).toBe("az once"));
  it("minutes", () => expect(formatRelativeDate(ago(5 * 60_000))).toBe("5 dakika once"));
  it("hours", () => expect(formatRelativeDate(ago(3 * 3_600_000))).toBe("3 saat once"));
  it("days", () => expect(formatRelativeDate(ago(2 * 86_400_000))).toBe("2 gun once"));
  it(">= 7 days falls back to absolute date", () => {
    const out = formatRelativeDate(ago(30 * 86_400_000));
    expect(out).not.toMatch(/once$/);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("formatDate", () => {
  it("formats a tr-TR long date string", () => {
    const out = formatDate("2026-01-15T00:00:00Z");
    expect(out).toMatch(/2026/);
    expect(out.length).toBeGreaterThan(6);
  });
});
