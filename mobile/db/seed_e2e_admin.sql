-- Seed a staging ADMIN account for the web admin-panel E2E suite
-- (web/e2e/*.admin.spec.ts). Run against the STAGING Supabase project only,
-- never paused prod.
--
-- The app authenticates by username, mapped to "<username>@app.com" for
-- Supabase Auth. SQL cannot safely create an auth.users row (password hashing
-- + identities), so create the login first, THEN run the promotion below.
--
-- STEP 1 — create the auth user (one of):
--   a) Supabase Dashboard -> Authentication -> Add user:
--        email = e2e_admin@app.com   password = Test1234!   (auto-confirm ON)
--   b) Or register username "e2e_admin" / "Test1234!" through the app's
--      /kayit (register) screen on staging.
--   The signup trigger creates the matching public.users row.
--
-- STEP 2 — promote that user to admin (idempotent):
update public.users
set user_type = 'admin'
where username = 'e2e_admin';

-- Verify:
--   select username, user_type, is_active from public.users where username = 'e2e_admin';
-- Expect: user_type = 'admin', is_active = true.
--
-- STEP 3 — add creds to web/e2e/.env.e2e :
--   E2E_ADMIN_USER=e2e_admin
--   E2E_ADMIN_PASS=Test1234!
