-- =====================================================
-- storage_verification_bucket.sql
-- Private bucket for ownership-verification documents
-- (vergi levhası, imza sirküleri, etc.)
--
-- These are high-PII + business-confidential and MUST NOT live in the
-- public `bilinc-media` bucket. Reads are restricted to the uploader and
-- admins; access is via short-TTL signed URLs only (never getPublicUrl).
--
-- Run order: after policies.sql. Idempotent.
-- Retention/delete policy: see handoff 07.
-- =====================================================

-- 1. Create the private bucket (id == name). public = false.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bilinc-verification',
  'bilinc-verification',
  false,
  10485760,                                  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,                        -- force-private even if it pre-existed public
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies on storage.objects scoped to this bucket.
--    Folder convention: bilinc-verification/<user_id>/<claim_id>/<file>
--    => (storage.foldername(name))[1] = the uploader's auth.uid()::text

-- INSERT: an authenticated user may upload only into their own <user_id>/ prefix.
DROP POLICY IF EXISTS "bilinc_verification_owner_insert" ON storage.objects;
CREATE POLICY "bilinc_verification_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bilinc-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: uploader OR admin. (Signed URLs are minted server-side / by owner;
--         this gates direct object reads.)
DROP POLICY IF EXISTS "bilinc_verification_owner_admin_select" ON storage.objects;
CREATE POLICY "bilinc_verification_owner_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bilinc-verification'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_type(auth.uid()) = 'admin'
    )
  );

-- UPDATE: uploader only (e.g. replace a rejected doc).
DROP POLICY IF EXISTS "bilinc_verification_owner_update" ON storage.objects;
CREATE POLICY "bilinc_verification_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bilinc-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: uploader OR admin (admin deletes after verify decision — handoff 07).
DROP POLICY IF EXISTS "bilinc_verification_owner_admin_delete" ON storage.objects;
CREATE POLICY "bilinc_verification_owner_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bilinc-verification'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_type(auth.uid()) = 'admin'
    )
  );

-- NOTE: no anon/public-read policy by design. Direct reads require auth + ownership/admin.
-- App must fetch via supabase.storage.from('bilinc-verification').createSignedUrl(path, 60).
