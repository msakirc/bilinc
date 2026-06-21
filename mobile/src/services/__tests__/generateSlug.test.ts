/**
 * Pure unit tests for DatabaseService.generateSlug.
 * No mocks — this is a pure string transformation function.
 */

// Mock supabase module so the DatabaseService module can be imported
// without needing real env vars. The mock is at module level because
// database.ts imports supabase at the top.
jest.mock('../supabase', () => ({
  supabase: {},
}));

import { DatabaseService } from '../database';

describe('DatabaseService.generateSlug', () => {
  it('lowercases and hyphenates a simple English phrase', () => {
    expect(DatabaseService.generateSlug('Hello World')).toBe('hello-world');
  });

  it('normalizes Turkish dotless-ı (lowercase) to i', () => {
    expect(DatabaseService.generateSlug('ışık')).toBe('isik');
  });

  it('normalizes Turkish uppercase İ (U+0130) to i', () => {
    // Fix: İ must be replaced BEFORE .toLowerCase() so the U+0307 combining dot
    // never appears in the string. Result should be 'istanbul', not 'i-stanbul'.
    expect(DatabaseService.generateSlug('İstanbul')).toBe('istanbul');
  });

  it('normalizes all-caps İZMİR to izmir', () => {
    expect(DatabaseService.generateSlug('İZMİR')).toBe('izmir');
  });

  it('normalizes mixed Turkish input "Şişli İlçesi" to sisli-ilcesi', () => {
    expect(DatabaseService.generateSlug('Şişli İlçesi')).toBe('sisli-ilcesi');
  });

  it('normalizes all six special Turkish characters (lowercase input has no İ bug)', () => {
    // ç→c, ğ→g, ü→u, ş→s, ö→o, ı→i — all work correctly for lowercase input
    expect(DatabaseService.generateSlug('Çiğköfteci Ömer')).toBe('cigkofteci-omer');
  });

  it('handles uppercase Turkish Ç Ğ Ü Ş Ö and İ correctly', () => {
    // After fix: İ should map to i, not i + combining dot.
    // 'ÇİĞÜŞÖ' → replace İ→i before toLowerCase → 'ciguso'
    expect(DatabaseService.generateSlug('ÇİĞÜŞÖ')).toBe('ciguso');
  });

  it('replaces punctuation runs with a single dash', () => {
    expect(DatabaseService.generateSlug('A...B  &  C!')).toBe('a-b-c');
  });

  it('trims leading and trailing dashes', () => {
    expect(DatabaseService.generateSlug('  -x-  ')).toBe('x');
  });

  it('collapses multiple consecutive dashes into one', () => {
    expect(DatabaseService.generateSlug('foo---bar')).toBe('foo-bar');
  });

  it('handles empty string by returning empty string', () => {
    // After all transforms, nothing remains — result is empty
    expect(DatabaseService.generateSlug('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    expect(DatabaseService.generateSlug('   ')).toBe('');
  });

  it('preserves numbers in output', () => {
    expect(DatabaseService.generateSlug('Cafe 34')).toBe('cafe-34');
  });

  it('does not produce a trailing dash from trailing punctuation', () => {
    expect(DatabaseService.generateSlug('abc!')).toBe('abc');
  });

  it('does not produce a leading dash from leading punctuation', () => {
    expect(DatabaseService.generateSlug('!abc')).toBe('abc');
  });

  it('handles a real Turkish business name end-to-end', () => {
    expect(DatabaseService.generateSlug('Şişli Köfte & Izgara')).toBe('sisli-kofte-izgara');
  });
});
