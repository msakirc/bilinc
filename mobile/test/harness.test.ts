/**
 * Smoke test — proves the jest harness can actually execute tests.
 * Also proves the no-network honesty guard fires.
 * This file is deleted after confirming green (or kept as the guard test).
 */

describe('jest harness smoke', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });

  it('honesty guard throws on real fetch calls', () => {
    expect(() => fetch('http://x')).toThrow('HONESTY GUARD');
  });
});
