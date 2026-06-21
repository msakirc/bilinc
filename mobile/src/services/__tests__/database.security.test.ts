/**
 * Service unit tests for DatabaseService — security question RPCs.
 * Covers: getSecurityQuestions, verifySecurityAnswers, setSecurityQuestions.
 *
 * All three methods call Supabase RPC. We assert:
 *   (a) exact RPC function name
 *   (b) exact params object sent
 *   (c) correct transform of the returned data
 *   (d) error propagation
 *   (e) edge cases (null/empty result, failure path, reset_token presence)
 */

import { makeSupabaseMock } from '../../../test/mocks/supabase';

const mockContainer = { client: null as any };

jest.mock('../supabase', () => ({
  supabase: new Proxy({}, {
    get(_target, prop) {
      return (mockContainer.client as any)[prop];
    },
  }),
}));

jest.mock('../dynamodb', () => ({
  getListing: jest.fn(),
  browseByCategory: jest.fn(),
  browseByCityCategory: jest.fn(),
  getRecentByType: jest.fn(),
  getBrandProducts: jest.fn(),
}));

jest.mock('../search', () => ({
  searchListings: jest.fn(),
  searchSuggestions: jest.fn(),
}));

import { DatabaseService } from '../database';

function setupMock(result: { data?: any; error?: any }) {
  const mock = makeSupabaseMock(result);
  mockContainer.client = mock.client;
  return mock;
}

// ---------------------------------------------------------------------------
// getSecurityQuestions
// ---------------------------------------------------------------------------

describe('DatabaseService.getSecurityQuestions', () => {
  it('calls RPC "get_security_questions" with exact param { p_username }', async () => {
    const { client } = setupMock({
      data: [{ question_1: 'İlk evcil hayvanın adı?', question_2: 'Anne kızlık soyadı?' }],
      error: null,
    });

    await DatabaseService.getSecurityQuestions('ali_veli');

    expect(client.rpc).toHaveBeenCalledWith('get_security_questions', {
      p_username: 'ali_veli',
    });
  });

  it('returns the first row of the result as { question_1, question_2 }', async () => {
    setupMock({
      data: [{ question_1: 'Soru 1', question_2: 'Soru 2' }],
      error: null,
    });

    const result = await DatabaseService.getSecurityQuestions('user1');

    expect(result).toEqual({ question_1: 'Soru 1', question_2: 'Soru 2' });
  });

  it('returns null when the RPC returns null data', async () => {
    // BEHAVIOR NOTE: data=null means "user not found" — the service returns null
    // rather than throwing. Callers must check for null to detect unknown users.
    setupMock({ data: null, error: null });

    const result = await DatabaseService.getSecurityQuestions('unknown_user');

    expect(result).toBeNull();
  });

  it('returns null when the RPC returns an empty array', async () => {
    // data=[] — username exists but no security questions set
    setupMock({ data: [], error: null });

    const result = await DatabaseService.getSecurityQuestions('new_user');

    // data?.[0] || null → undefined || null → null
    expect(result).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'function does not exist' } });

    await expect(
      DatabaseService.getSecurityQuestions('alice')
    ).rejects.toMatchObject({ message: 'function does not exist' });
  });
});

// ---------------------------------------------------------------------------
// verifySecurityAnswers
// ---------------------------------------------------------------------------

describe('DatabaseService.verifySecurityAnswers', () => {
  it('calls RPC "verify_security_answers" with exact params', async () => {
    const { client } = setupMock({
      data: [{ success: true, message: 'Doğrulama başarılı', reset_token: 'tok-abc' }],
      error: null,
    });

    await DatabaseService.verifySecurityAnswers('ali_veli', 'pamuq', 'fatma');

    expect(client.rpc).toHaveBeenCalledWith('verify_security_answers', {
      p_username: 'ali_veli',
      p_answer_1: 'pamuq',
      p_answer_2: 'fatma',
    });
  });

  it('returns { success: true, message, reset_token } on correct answers', async () => {
    setupMock({
      data: [{ success: true, message: 'Doğrulama başarılı', reset_token: 'tok-xyz123' }],
      error: null,
    });

    const result = await DatabaseService.verifySecurityAnswers('user1', 'a1', 'a2');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Doğrulama başarılı');
    expect(result.reset_token).toBe('tok-xyz123');
  });

  it('returns { success: false, message } on wrong answers (no reset_token)', async () => {
    setupMock({
      data: [{ success: false, message: 'Cevaplar hatalı' }],
      error: null,
    });

    const result = await DatabaseService.verifySecurityAnswers('user1', 'wrong1', 'wrong2');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Cevaplar hatalı');
    expect(result.reset_token).toBeUndefined();
  });

  it('returns fallback { success: false, message: "Verification failed" } when data is null', async () => {
    // BEHAVIOR NOTE: null data returns the hardcoded fallback object rather than null.
    // This means callers always receive a valid shape even for unexpected nulls.
    setupMock({ data: null, error: null });

    const result = await DatabaseService.verifySecurityAnswers('user1', 'a1', 'a2');

    expect(result).toEqual({ success: false, message: 'Verification failed' });
  });

  it('returns fallback { success: false, message: "Verification failed" } when data is empty array', async () => {
    setupMock({ data: [], error: null });

    const result = await DatabaseService.verifySecurityAnswers('user1', 'a1', 'a2');

    expect(result).toEqual({ success: false, message: 'Verification failed' });
  });

  it('returns { success: false } on lockout (too many failed attempts)', async () => {
    setupMock({
      data: [{ success: false, message: 'Hesap kilitlendi' }],
      error: null,
    });

    const result = await DatabaseService.verifySecurityAnswers('locked_user', 'a1', 'a2');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Hesap kilitlendi');
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'RPC error' } });

    await expect(
      DatabaseService.verifySecurityAnswers('user1', 'a1', 'a2')
    ).rejects.toMatchObject({ message: 'RPC error' });
  });
});

// ---------------------------------------------------------------------------
// setSecurityQuestions
// ---------------------------------------------------------------------------

describe('DatabaseService.setSecurityQuestions', () => {
  it('calls RPC "set_security_questions" with exact params', async () => {
    const { client } = setupMock({ data: true, error: null });

    await DatabaseService.setSecurityQuestions(
      'İlk evcil hayvanın adı?',
      'pamuq',
      'Annenin kızlık soyadı?',
      'fatma'
    );

    expect(client.rpc).toHaveBeenCalledWith('set_security_questions', {
      p_question_1: 'İlk evcil hayvanın adı?',
      p_answer_1: 'pamuq',
      p_question_2: 'Annenin kızlık soyadı?',
      p_answer_2: 'fatma',
    });
  });

  it('returns true on success (as the RPC returns)', async () => {
    setupMock({ data: true, error: null });

    const result = await DatabaseService.setSecurityQuestions('Q1', 'A1', 'Q2', 'A2');

    expect(result).toBe(true);
  });

  it('returns false when RPC explicitly returns false (update failed)', async () => {
    // BEHAVIOR NOTE: RPC may return false to indicate that the update was rejected
    // (e.g., user not authenticated). The service passes this value through unchanged.
    setupMock({ data: false, error: null });

    const result = await DatabaseService.setSecurityQuestions('Q1', 'A1', 'Q2', 'A2');

    expect(result).toBe(false);
  });

  it('throws when Supabase returns an error', async () => {
    setupMock({ data: null, error: { message: 'not authenticated', code: 'PGRST301' } });

    await expect(
      DatabaseService.setSecurityQuestions('Q1', 'A1', 'Q2', 'A2')
    ).rejects.toMatchObject({ message: 'not authenticated' });
  });

  it('passes all four args independently (does not conflate Q1/Q2 or A1/A2)', async () => {
    const { client } = setupMock({ data: true, error: null });

    await DatabaseService.setSecurityQuestions('Soru A', 'Cevap X', 'Soru B', 'Cevap Y');

    const rpcCall = (client.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall[1].p_question_1).toBe('Soru A');
    expect(rpcCall[1].p_answer_1).toBe('Cevap X');
    expect(rpcCall[1].p_question_2).toBe('Soru B');
    expect(rpcCall[1].p_answer_2).toBe('Cevap Y');
    // Sanity: none of the fields is the same as another in this specific test
    expect(rpcCall[1].p_question_1).not.toBe(rpcCall[1].p_question_2);
    expect(rpcCall[1].p_answer_1).not.toBe(rpcCall[1].p_answer_2);
  });
});
