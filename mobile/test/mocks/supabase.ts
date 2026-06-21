/**
 * Chainable Supabase mock.
 * Returns a fake client whose query builder records calls and returns a canned result.
 * Usage:
 *   const { client, calls } = makeSupabaseMock({ data: { id: 'f1' }, error: null });
 *   jest.mock('../supabase', () => ({ __esModule: true, default: client }));
 */
export function makeSupabaseMock(
  result: { data?: any; error?: any } = { data: null, error: null }
) {
  const calls: Array<[string, any[]]> = [];

  const builder: any = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gte', 'lte', 'order', 'limit',
    'single', 'range', 'filter', 'in',
  ];
  for (const m of chainMethods) {
    builder[m] = jest.fn((...args: any[]) => {
      calls.push([m, args]);
      return builder;
    });
  }
  // Make the builder awaitable — resolves to the canned result
  builder.then = (resolve: (v: any) => any) => Promise.resolve(result).then(resolve);

  const client = {
    from: jest.fn((table: string) => {
      calls.push(['from', [table]]);
      return builder;
    }),
    rpc: jest.fn((fn: string, params?: any) => {
      calls.push(['rpc', [fn, params]]);
      return Promise.resolve(result);
    }),
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve(result)),
      signUp: jest.fn(() => Promise.resolve(result)),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() => Promise.resolve(result)),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve(result)),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'http://x/y.jpg' } })),
      })),
    },
  };

  return { client, calls };
}
