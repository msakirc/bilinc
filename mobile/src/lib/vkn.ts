// Turkish VKN (Vergi Kimlik Numarası) — 10-digit business tax number.
// Validates the official checksum so we reject typos before a claim is filed.
// Low-PII (a business identifier, not a person's TCKN), kept for admin cross-check.
// Ported from web/src/lib/vkn.ts — keep in sync.

export function isValidVKN(value: string): boolean {
  const v = (value || '').trim();
  if (!/^[0-9]{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  const last = d[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    sum += tmp === 9 ? tmp : (tmp * Math.pow(2, 9 - i)) % 9;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === last;
}
