import { describe, it, expect } from "vitest";
import { getLegalDoc, LEGAL_DOCS, LEGAL_URLS, KVKK_CONSENT_TEXT } from "./legal";

describe("getLegalDoc", () => {
  it.each(["kosullar", "gizlilik", "kvkk"])("returns the %s doc", (key) => {
    const doc = getLegalDoc(key);
    expect(doc).not.toBeNull();
    expect(doc!.key).toBe(key);
    expect(doc!.title.length).toBeGreaterThan(0);
    expect(doc!.body.length).toBeGreaterThan(200);
  });

  it("returns null for unknown / missing keys", () => {
    for (const k of [undefined, "", "nope", "terms", "privacy"]) {
      expect(getLegalDoc(k as string)).toBeNull();
    }
  });
});

describe("LEGAL_DOCS content", () => {
  it("every doc carries the draft banner until lawyer review", () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      expect(doc.body.startsWith("TASLAK")).toBe(true);
    }
  });

  it("titles are Turkish with correct diacritics", () => {
    expect(LEGAL_DOCS.kosullar.title).toBe("Kullanım Koşulları");
    expect(LEGAL_DOCS.gizlilik.title).toBe("Gizlilik Politikası");
    expect(LEGAL_DOCS.kvkk.title).toBe("KVKK Aydınlatma Metni");
  });

  it("KVKK doc surfaces the exact register-form consent text", () => {
    expect(LEGAL_DOCS.kvkk.body).toContain(KVKK_CONSENT_TEXT);
    expect(KVKK_CONSENT_TEXT).toContain("KVKK m. 9");
    expect(KVKK_CONSENT_TEXT).toContain("açık rıza");
  });
});

describe("LEGAL_URLS", () => {
  it("point under /yasal/ and match the doc keys", () => {
    expect(LEGAL_URLS.terms).toBe("/yasal/kosullar");
    expect(LEGAL_URLS.privacy).toBe("/yasal/gizlilik");
    expect(LEGAL_URLS.kvkk).toBe("/yasal/kvkk");
    for (const url of Object.values(LEGAL_URLS)) {
      const key = url.split("/").pop()!;
      expect(getLegalDoc(key)).not.toBeNull();
    }
  });
});
