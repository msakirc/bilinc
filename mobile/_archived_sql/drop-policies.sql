-- DROP ALL EXISTING POLICIES FIRST
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Allow registration (users can insert their own record during signup)" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

DROP POLICY IF EXISTS "Public can view listings" ON listings;
DROP POLICY IF EXISTS "Authenticated users can create listings" ON listings;
DROP POLICY IF EXISTS "Creators can update own listings" ON listings;
DROP POLICY IF EXISTS "Owners can update claimed listings" ON listings;
DROP POLICY IF EXISTS "Admins can update listings" ON listings;

-- Add more DROP statements for other tables as needed
-- Then disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE facts DISABLE ROW LEVEL SECURITY;