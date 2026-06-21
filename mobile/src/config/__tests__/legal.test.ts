/**
 * Pure unit tests for getLegalDoc.
 * No mocks — this is a pure lookup over a static in-memory map.
 */

import {
  getLegalDoc,
  LEGAL_DOCS,
  KVKK_CONSENT_TEXT,
  BUSINESS_VERIFICATION_CONSENT_TEXT,
} from '../legal';

describe('getLegalDoc', () => {
  it('returns the kvkk doc for key "kvkk"', () => {
    const doc = getLegalDoc('kvkk');
    expect(doc).not.toBeNull();
    expect(doc!.key).toBe('kvkk');
    expect(doc!.title).toBe('KVKK Aydınlatma Metni');
  });

  it('returns the kosullar doc for key "kosullar"', () => {
    const doc = getLegalDoc('kosullar');
    expect(doc).not.toBeNull();
    expect(doc!.key).toBe('kosullar');
    expect(doc!.title).toBe('Kullanım Koşulları');
  });

  it('returns the gizlilik doc for key "gizlilik"', () => {
    const doc = getLegalDoc('gizlilik');
    expect(doc).not.toBeNull();
    expect(doc!.key).toBe('gizlilik');
    expect(doc!.title).toBe('Gizlilik Politikası');
  });

  it('returns null for an unknown key', () => {
    expect(getLegalDoc('nope')).toBeNull();
  });

  it('returns null for an empty string key', () => {
    expect(getLegalDoc('')).toBeNull();
  });

  it('returns null for undefined key', () => {
    expect(getLegalDoc(undefined)).toBeNull();
  });

  it('returns null for a key that is a prefix of a valid key (partial match)', () => {
    // "kvk" is not the same as "kvkk" — no prefix matching
    expect(getLegalDoc('kvk')).toBeNull();
  });

  it('returns null for a key with wrong case — matching is case-sensitive', () => {
    // The map keys are lowercase; "KVKK" should not match "kvkk"
    expect(getLegalDoc('KVKK')).toBeNull();
  });

  it('returned doc body is a non-empty string containing Turkish text', () => {
    const doc = getLegalDoc('kvkk');
    expect(typeof doc!.body).toBe('string');
    expect(doc!.body.length).toBeGreaterThan(100);
    // The body includes the TASLAK warning banner (draft marker)
    expect(doc!.body).toContain('TASLAK');
  });

  it('returned doc object is the same reference as LEGAL_DOCS (no copy)', () => {
    // Confirms getLegalDoc returns the stored object directly, not a clone
    const doc = getLegalDoc('gizlilik');
    expect(doc).toBe(LEGAL_DOCS.gizlilik);
  });
});

describe('KVKK_CONSENT_TEXT content spot-checks', () => {
  it('contains the Turkish KVKK article reference (KVKK m. 9)', () => {
    expect(KVKK_CONSENT_TEXT).toContain('KVKK m. 9');
  });

  it('contains the consent action phrase "açık rıza veriyorum"', () => {
    expect(KVKK_CONSENT_TEXT).toContain('açık rıza veriyorum');
  });

  it('contains mention of Supabase infrastructure', () => {
    expect(KVKK_CONSENT_TEXT).toContain('Supabase');
  });

  it('mentions yurt dışına aktarım (cross-border transfer)', () => {
    expect(KVKK_CONSENT_TEXT).toContain('yurt dışına aktarılmasına');
  });

  it('is a non-trivially long string (> 100 chars)', () => {
    expect(KVKK_CONSENT_TEXT.length).toBeGreaterThan(100);
  });
});

describe('LEGAL_DOCS body content spot-checks', () => {
  const DRAFT_PREFIX = 'TASLAK';

  it('kvkk body starts with the TASLAK draft banner', () => {
    expect(LEGAL_DOCS.kvkk.body).toContain(DRAFT_PREFIX);
    // The banner is at the very start
    expect(LEGAL_DOCS.kvkk.body.indexOf(DRAFT_PREFIX)).toBe(0);
  });

  it('kosullar body starts with the TASLAK draft banner', () => {
    expect(LEGAL_DOCS.kosullar.body).toContain(DRAFT_PREFIX);
    expect(LEGAL_DOCS.kosullar.body.indexOf(DRAFT_PREFIX)).toBe(0);
  });

  it('gizlilik body starts with the TASLAK draft banner', () => {
    expect(LEGAL_DOCS.gizlilik.body).toContain(DRAFT_PREFIX);
    expect(LEGAL_DOCS.gizlilik.body.indexOf(DRAFT_PREFIX)).toBe(0);
  });

  it('getLegalDoc("kvkk").body length is > 200 chars', () => {
    const doc = getLegalDoc('kvkk');
    expect(doc!.body.length).toBeGreaterThan(200);
  });

  it('kvkk body embeds the KVKK_CONSENT_TEXT verbatim', () => {
    // The KVKK body concatenates KVKK_CONSENT_TEXT; assert it is present unchanged
    expect(LEGAL_DOCS.kvkk.body).toContain(KVKK_CONSENT_TEXT);
  });

  it('kvkk body contains the KVKK article 11 rights heading', () => {
    expect(LEGAL_DOCS.kvkk.body).toContain('Haklarınız (KVKK m. 11)');
  });

  it('kosullar body contains the terms section heading for platform role', () => {
    expect(LEGAL_DOCS.kosullar.body).toContain('5651 sayılı Kanun');
  });

  it('gizlilik body contains the privacy policy KVKK compliance header', () => {
    expect(LEGAL_DOCS.gizlilik.body).toContain('KVKK Uyumlu');
  });

  it('gizlilik body mentions Supabase as infrastructure provider', () => {
    expect(LEGAL_DOCS.gizlilik.body).toContain('Supabase');
  });

  it('all three docs have bodies longer than 500 chars (full legal text, not stubs)', () => {
    expect(LEGAL_DOCS.kvkk.body.length).toBeGreaterThan(500);
    expect(LEGAL_DOCS.kosullar.body.length).toBeGreaterThan(500);
    expect(LEGAL_DOCS.gizlilik.body.length).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// BUSINESS_VERIFICATION_CONSENT_TEXT — video + VKN consent
// ---------------------------------------------------------------------------
describe('BUSINESS_VERIFICATION_CONSENT_TEXT', () => {
  it('contains "video" (işletme doğrulama videosu reference)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).toContain('video');
  });

  it('contains "VKN" (vergi kimlik numarası reference)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).toContain('VKN');
  });

  it('contains "vergi kimlik" (full phrase)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).toContain('vergi kimlik');
  });

  it('does NOT mention "ödeme" (payment)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('ödeme');
  });

  it('does NOT mention "kart" (card)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('kart');
  });

  it('does NOT mention "vergi levhası" (tax certificate document)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('vergi levhası');
  });

  it('does NOT mention "telefon"', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('telefon');
  });

  it('does NOT mention "e-posta"', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('e-posta');
  });

  it('does NOT mention "alan adı"', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).not.toContain('alan adı');
  });

  it('contains rıza action phrase "açık rıza veriyorum"', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).toContain('açık rıza veriyorum');
  });

  it('mentions withdrawal of consent (geri çekebileceğimi)', () => {
    expect(BUSINESS_VERIFICATION_CONSENT_TEXT).toContain('geri çekebileceğimi');
  });
});

// ---------------------------------------------------------------------------
// isletme-dogrulama LEGAL_DOCS entry (VERIFICATION_BODY via LEGAL_DOCS)
// ---------------------------------------------------------------------------
describe('LEGAL_DOCS["isletme-dogrulama"]', () => {
  const doc = LEGAL_DOCS['isletme-dogrulama'];

  it('entry exists in LEGAL_DOCS', () => {
    expect(doc).toBeDefined();
  });

  it('has correct key', () => {
    expect(doc.key).toBe('isletme-dogrulama');
  });

  it('has correct title', () => {
    expect(doc.title).toBe('İşletme Doğrulama Aydınlatma Metni');
  });

  it('getLegalDoc("isletme-dogrulama") resolves the entry', () => {
    const resolved = getLegalDoc('isletme-dogrulama');
    expect(resolved).not.toBeNull();
    expect(resolved).toBe(doc);
  });

  it('body contains "video"', () => {
    expect(doc.body).toContain('video');
  });

  it('body contains "VKN"', () => {
    expect(doc.body).toContain('VKN');
  });

  it('body mentions deletion/silme (ham video silinir)', () => {
    // "silinir" or "silini" covers "kalıcı olarak silinir", "silinir" etc.
    expect(doc.body).toMatch(/silin/);
  });

  it('body contains bystander cue — "çalışan" (employee/bystander)', () => {
    expect(doc.body).toContain('çalışan');
  });

  it('body contains bystander cue — "müşteri" (customer/bystander)', () => {
    expect(doc.body).toContain('müşteri');
  });

  it('body starts with TASLAK draft banner', () => {
    expect(doc.body).toContain('TASLAK');
    expect(doc.body.indexOf('TASLAK')).toBe(0);
  });

  it('body embeds BUSINESS_VERIFICATION_CONSENT_TEXT verbatim', () => {
    expect(doc.body).toContain(BUSINESS_VERIFICATION_CONSENT_TEXT);
  });

  it('body is longer than 500 chars (full aydınlatma text, not a stub)', () => {
    expect(doc.body.length).toBeGreaterThan(500);
  });
});
