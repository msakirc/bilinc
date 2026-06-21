-- Test query to check if tables exist and RLS is working
-- Run this in Supabase SQL Editor

-- Check if users table exists and has data
SELECT 'users table' as table_name, COUNT(*) as record_count FROM users;

-- Check if listings table exists
SELECT 'listings table' as table_name, COUNT(*) as record_count FROM listings;

-- Check if reviews table exists
SELECT 'reviews table' as table_name, COUNT(*) as record_count FROM reviews;

-- Test RLS by trying to select without auth (should work for public tables)
SELECT 'listings public access' as test, COUNT(*) as count FROM listings LIMIT 1;

-- Check RLS policies are applied
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'listings', 'reviews', 'facts')
ORDER BY tablename;