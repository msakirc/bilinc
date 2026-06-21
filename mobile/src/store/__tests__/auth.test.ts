/**
 * Service unit tests for the auth Zustand store.
 * Covers: signIn, signUp, signOut, refreshUser.
 *
 * Key edge cases from the Addendum:
 * - signIn: success sets user+session, wrong-creds error, loading toggles
 * - signUp: success inserts user row, duplicate error
 * - signOut: clears state
 * - refreshUser: session present → user, no session → null
 *
 * The auth store is a singleton Zustand store. Between tests we reset its
 * state to avoid inter-test contamination.
 */

import { makeSupabaseMock } from '../../../test/mocks/supabase';

const mockContainer = { client: null as any };

jest.mock('../../services/supabase', () => ({
  supabase: new Proxy({}, {
    get(_target, prop) {
      return (mockContainer.client as any)[prop];
    },
  }),
}));

function setupMock(result: { data?: any; error?: any }) {
  const mock = makeSupabaseMock(result);
  mockContainer.client = mock.client;
  return mock;
}

// We import the store AFTER mocking supabase
import { useAuthStore } from '../auth';

// Helper: read current store state without subscribing to a React component
const getState = () => useAuthStore.getState();

// Reset store to known initial state between tests
beforeEach(() => {
  useAuthStore.setState({ user: null, session: null, loading: true });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('authStore.signIn', () => {
  it('converts username to email format (username@app.com) for Supabase auth', async () => {
    const { client } = setupMock({
      data: {
        user: { id: 'u1' },
        session: { access_token: 'tok' },
      },
      error: null,
    });
    // Make the profile fetch also succeed
    mockContainer.client = {
      ...client,
      auth: {
        ...client.auth,
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: { id: 'u1', username: 'alice' }, error: null }).then(resolve),
      }),
    };

    await getState().signIn('alice', 'password123');

    expect(mockContainer.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@app.com',
      password: 'password123',
    });
  });

  it('sets user and session in store on successful sign in', async () => {
    const fakeUser = { id: 'u1', username: 'alice', user_type: 'consumer', reputation_score: 0, credibility_level: 'novice', is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' };
    const fakeSession = { access_token: 'tok123' };

    mockContainer.client = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1' }, session: fakeSession },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: fakeUser, error: null }).then(resolve),
      }),
    };

    await getState().signIn('alice', 'password123');

    const state = getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.session).toEqual(fakeSession);
    expect(state.loading).toBe(false);
  });

  it('sets loading to true during sign in then to false after', async () => {
    const loadingStates: boolean[] = [];

    mockContainer.client = {
      auth: {
        signInWithPassword: jest.fn().mockImplementation(async () => {
          loadingStates.push(getState().loading);
          return { data: { user: { id: 'u1' }, session: {} }, error: null };
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: { id: 'u1', username: 'alice' }, error: null }).then(resolve),
      }),
    };

    await getState().signIn('alice', 'pass');

    // loading was true during the auth call
    expect(loadingStates[0]).toBe(true);
    // loading is false after completion
    expect(getState().loading).toBe(false);
  });

  it('throws and sets loading=false when credentials are wrong', async () => {
    mockContainer.client = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
      from: jest.fn(),
    };

    await expect(getState().signIn('alice', 'wrongpass')).rejects.toMatchObject({
      message: 'Invalid login credentials',
    });

    expect(getState().loading).toBe(false);
    expect(getState().user).toBeNull();
  });

  it('throws and sets loading=false when profile fetch fails after auth succeeds', async () => {
    mockContainer.client = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1' }, session: {} },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'profile not found' } }).then(resolve),
      }),
    };

    await expect(getState().signIn('alice', 'pass')).rejects.toMatchObject({
      message: 'profile not found',
    });

    expect(getState().loading).toBe(false);
    expect(getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

describe('authStore.signUp', () => {
  it('creates auth user and inserts user profile row', async () => {
    const fakeUser = { id: 'u2', username: 'bob', user_type: 'consumer', reputation_score: 0, credibility_level: 'novice', is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' };
    const mockFrom = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: fakeUser, error: null }).then(resolve),
    });

    mockContainer.client = {
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: { id: 'u2' }, session: { access_token: 'tok' } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    await getState().signUp('bob', 'password123');

    expect(mockContainer.client.auth.signUp).toHaveBeenCalledWith({
      email: 'bob@app.com',
      password: 'password123',
    });
    expect(mockFrom).toHaveBeenCalledWith('users');

    const state = getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.loading).toBe(false);
  });

  it('inserts user row with correct fields including username trimmed', async () => {
    const insertMock = jest.fn().mockReturnThis();
    const mockFrom = jest.fn().mockReturnValue({
      insert: insertMock,
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: { id: 'u3', username: 'charlie' }, error: null }).then(resolve),
    });

    mockContainer.client = {
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: { id: 'u3' }, session: {} },
          error: null,
        }),
      },
      from: mockFrom,
    };

    await getState().signUp('charlie', 'pass12345');

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'u3',
        username: 'charlie',
        user_type: 'consumer',
        reputation_score: 0,
        credibility_level: 'novice',
        is_active: true,
      })
    );
  });

  it('throws and sets loading=false on duplicate username error', async () => {
    mockContainer.client = {
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: { id: 'u4' }, session: null },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }).then(resolve),
      }),
    };

    await expect(getState().signUp('duplicate', 'pass12345')).rejects.toMatchObject({
      message: 'duplicate key value violates unique constraint',
    });

    expect(getState().loading).toBe(false);
    expect(getState().user).toBeNull();
  });

  it('throws and sets loading=false when Supabase auth signUp fails', async () => {
    mockContainer.client = {
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Email already registered' },
        }),
      },
      from: jest.fn(),
    };

    await expect(getState().signUp('existing', 'pass12345')).rejects.toMatchObject({
      message: 'Email already registered',
    });

    expect(getState().loading).toBe(false);
  });

  it('sets loading to true during sign up then to false after', async () => {
    const loadingStates: boolean[] = [];

    mockContainer.client = {
      auth: {
        signUp: jest.fn().mockImplementation(async () => {
          loadingStates.push(getState().loading);
          return { data: { user: { id: 'u5' }, session: {} }, error: null };
        }),
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: { id: 'u5', username: 'eve' }, error: null }).then(resolve),
      }),
    };

    await getState().signUp('eve', 'pass123');

    expect(loadingStates[0]).toBe(true);
    expect(getState().loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('authStore.signOut', () => {
  it('clears user, session, and sets loading=false on successful sign out', async () => {
    // Pre-populate the store with a user
    useAuthStore.setState({
      user: { id: 'u1', username: 'alice', user_type: 'consumer', reputation_score: 0, credibility_level: 'novice', is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' },
      session: { access_token: 'tok' },
      loading: false,
    });

    const { client } = setupMock({ error: null });
    // Override signOut specifically
    mockContainer.client = {
      ...client,
      auth: {
        ...client.auth,
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    };

    await getState().signOut();

    const state = getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('throws when Supabase signOut returns an error', async () => {
    mockContainer.client = {
      auth: {
        signOut: jest.fn().mockResolvedValue({ error: { message: 'sign out failed' } }),
      },
    };

    await expect(getState().signOut()).rejects.toMatchObject({ message: 'sign out failed' });
  });
});

// ---------------------------------------------------------------------------
// refreshUser
// ---------------------------------------------------------------------------

describe('authStore.refreshUser', () => {
  it('sets user and session when a valid session is present', async () => {
    const fakeUser = { id: 'u1', username: 'alice', user_type: 'consumer', reputation_score: 10, credibility_level: 'novice', is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' };
    const fakeSession = { access_token: 'tok', user: { id: 'u1' } };

    mockContainer.client = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: fakeSession },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: fakeUser, error: null }).then(resolve),
      }),
    };

    await getState().refreshUser();

    const state = getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.session).toEqual(fakeSession);
    expect(state.loading).toBe(false);
  });

  it('sets user=null and session=null when no active session', async () => {
    mockContainer.client = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
      from: jest.fn(),
    };

    await getState().refreshUser();

    const state = getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('preserves existing user when getSession returns a transient error', async () => {
    // CORRECT BEHAVIOR: A transient getSession error (network blip, server hiccup)
    // must NOT clear a pre-existing authenticated user.
    // Distinguishes "no session" (data.session==null, no error) from "error" (can't tell).
    const existingUser = { id: 'u1', username: 'alice', user_type: 'consumer' as const, reputation_score: 50, credibility_level: 'novice' as const, is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' };
    const existingSession = { access_token: 'existing-tok' };
    useAuthStore.setState({ user: existingUser, session: existingSession, loading: false });

    mockContainer.client = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'session fetch failed' },
        }),
      },
      from: jest.fn(),
    };

    // Should NOT throw
    await expect(getState().refreshUser()).resolves.toBeUndefined();

    const state = getState();
    // User must be preserved — transient error must not log the user out
    expect(state.user).toEqual(existingUser);
    // Session must also be preserved
    expect(state.session).toEqual(existingSession);
    expect(state.loading).toBe(false);
  });

  it('preserves session when profile fetch fails after a valid session is found', async () => {
    // CORRECT BEHAVIOR: If getSession returns a valid session but the profile DB query
    // fails transiently, the session must NOT be cleared. The user stays logged in.
    const existingUser = { id: 'u1', username: 'alice', user_type: 'consumer' as const, reputation_score: 50, credibility_level: 'novice' as const, is_active: true, created_at: '2026-01-01', last_active: '2026-01-01' };
    const validSession = { access_token: 'tok', user: { id: 'u1' } };
    useAuthStore.setState({ user: existingUser, session: validSession, loading: false });

    mockContainer.client = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: validSession },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'profile DB error' } }).then(resolve),
      }),
    };

    // Should NOT throw
    await expect(getState().refreshUser()).resolves.toBeUndefined();

    // Session must be preserved — a profile DB failure must not destroy the session
    expect(getState().session).toEqual(validSession);
    // User left as-is (prior state preserved)
    expect(getState().user).toEqual(existingUser);
    expect(getState().loading).toBe(false);
  });

  it('catches unexpected thrown exceptions and sets loading=false', async () => {
    // The outer try/catch in refreshUser handles thrown (not resolved) errors
    mockContainer.client = {
      auth: {
        getSession: jest.fn().mockRejectedValue(new Error('network failure')),
      },
      from: jest.fn(),
    };

    await expect(getState().refreshUser()).resolves.toBeUndefined();

    expect(getState().user).toBeNull();
    expect(getState().loading).toBe(false);
  });
});
