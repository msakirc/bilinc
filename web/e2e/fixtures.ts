// Seed throwaway rows directly through the staging Supabase REST API as a
// disposable "fixture" user, so the admin write/mutation specs are
// self-contained and repeatable (each test creates the rows it then acts on).
//
// RLS lets an authenticated user self-insert listings / reviews / claims /
// edits; facts need reputation >= 100, which the e2e_fixture user has. All
// values are bound server-side; ids are returned by Supabase (uuid default).
//
// Reads NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY from process.env (playwright.config
// loads e2e/.env.e2e into it).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function h(token: string, extra: Record<string, string> = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`${init.method} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Password-grant login; returns an access token for REST + Storage calls. */
export async function fixtureToken(user: string, pass: string): Promise<string> {
  const data = await rest<{ access_token: string }>(
    "/auth/v1/token?grant_type=password",
    { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: `${user.toLowerCase()}@app.com`, password: pass }) },
  );
  return data.access_token;
}

export async function fixtureUserId(token: string): Promise<string> {
  const u = await rest<{ id: string }>("/auth/v1/user", { headers: h(token) });
  return u.id;
}

async function insertReturning<T>(table: string, token: string, row: Record<string, unknown>): Promise<T> {
  const rows = await rest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: h(token, { Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  return rows[0];
}

export interface SeedCtx {
  token: string;
  userId: string;
}

let seq = 0;
/** listings.slug is derived from name and is UNIQUE, so make every seeded name
 *  unique per run to keep the seed idempotent across re-runs. Returns the id AND
 *  the unique name actually inserted (so tests can assert it renders). */
export async function seedListing(
  ctx: SeedCtx,
  name = "E2E Fixture Biz",
  status: "active" | "pending" | "removed" = "active",
): Promise<{ id: string; name: string }> {
  const unique = `${name} ${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const row = await insertReturning<{ id: string; name: string }>("listings", ctx.token, {
    name: unique,
    entity_type: "business",
    status,
    created_by: ctx.userId,
  });
  return { id: row.id, name: unique };
}

export async function seedReview(ctx: SeedCtx, listingId: string): Promise<{ id: string }> {
  return insertReturning("reviews", ctx.token, {
    listing_id: listingId,
    user_id: ctx.userId,
    rating: 5,
    content: "e2e fixture review — safe to delete",
    status: "active",
  });
}

export async function seedFact(ctx: SeedCtx, listingId: string): Promise<{ id: string }> {
  return insertReturning("facts", ctx.token, {
    listing_id: listingId,
    user_id: ctx.userId,
    statement: "e2e fixture fact — safe to delete",
    category: "safety",
    verification_status: "pending",
  });
}

export async function seedClaim(ctx: SeedCtx, listingId: string, documentPath?: string): Promise<{ id: string }> {
  return insertReturning("listing_claims", ctx.token, {
    listing_id: listingId,
    user_id: ctx.userId,
    role: "owner",
    status: "pending",
    verification_method: "document",
    ...(documentPath ? { verification_document_url: documentPath } : {}),
  });
}

export async function seedEdit(ctx: SeedCtx, listingId: string): Promise<{ id: string }> {
  // Use a column that actually exists on listings — apply_approved_edit() runs
  // `UPDATE listings SET <field_name>=...` on approve, so a non-existent column
  // (e.g. phone/website, which listings lacks) would make approval throw.
  return insertReturning("listing_edits", ctx.token, {
    listing_id: listingId,
    user_id: ctx.userId,
    field_name: "description",
    old_value: "old e2e description",
    new_value: "e2e approved description",
    status: "pending",
  });
}

/** Upload a tiny PDF to the private bilinc-verification bucket under the user's
 *  own prefix and return the storage path (for the doc-view test). `key` is any
 *  subpath segment under the user id (RLS only enforces the user-id prefix); use
 *  the listing id so the path is known before the claim row is inserted. */
export async function uploadVerificationDoc(ctx: SeedCtx, key: string): Promise<string> {
  const path = `${ctx.userId}/${key}/proof.pdf`;
  const res = await fetch(`${URL}/storage/v1/object/bilinc-verification/${path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/pdf" },
    body: new Blob(["%PDF-1.4\n% e2e fixture\n"], { type: "application/pdf" }),
  });
  if (!res.ok) throw new Error(`upload doc -> ${res.status} ${await res.text()}`);
  return path;
}

/** Try to self-set a privileged column; returns the HTTP status (for the
 *  escalation regression test — expected to be rejected once RLS is fixed). */
export async function attemptSelfPatch(token: string, userId: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${URL}/rest/v1/users?id=eq.${userId}`, {
    method: "PATCH",
    headers: h(token, { Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  return res.status;
}

/** Read a single row by id (PostgREST). Uses the given token if the table is
 *  RLS-restricted (e.g. listing_claims select-own), else the anon key. Returns
 *  null if not visible/found. For asserting backend side-effects of admin actions. */
export async function getRow<T = Record<string, unknown>>(
  table: string, id: string, select = "*", token?: string,
): Promise<T | null> {
  const auth = token ?? KEY;
  const rows = await rest<T[]>(
    `/rest/v1/${table}?id=eq.${id}&select=${encodeURIComponent(select)}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${auth}` } },
  );
  return rows[0] ?? null;
}

export async function readUser(userId: string): Promise<{ user_type: string; reputation_score: number } | null> {
  const rows = await rest<{ user_type: string; reputation_score: number }[]>(
    `/rest/v1/users?id=eq.${userId}&select=user_type,reputation_score`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  return rows[0] ?? null;
}
