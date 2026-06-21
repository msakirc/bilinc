# Supabase Storage Setup

Image uploads (review photos, fact evidence, listing photos, avatars) need a
Storage bucket. Bucket creation must be done from the Supabase Dashboard or via
the Management API — it cannot be done from a plain SQL migration. Follow these
steps once per environment.

## 1. Create the bucket

Dashboard: **Storage → New bucket**

- **Name:** `bilinc-media`
- **Public bucket:** ON (public read — listing/review/fact images are public)
- **File size limit:** 5 MB (recommended)
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`

Suggested folder convention (prefix within the bucket):

```
bilinc-media/
├── reviews/<review_id>/<uuid>.jpg
├── facts/<fact_id>/<uuid>.jpg
├── listings/<listing_id>/<uuid>.jpg
└── avatars/<user_id>.jpg
```

## 2. Storage RLS policies

Storage objects live in `storage.objects`. After creating the bucket, run the
SQL below (SQL Editor) to allow public read and authenticated writes scoped to
the `bilinc-media` bucket.

```sql
-- Public read for everything in the bucket
CREATE POLICY "bilinc_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bilinc-media');

-- Authenticated users can upload
CREATE POLICY "bilinc_media_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bilinc-media');

-- Users can update/delete only their own objects
CREATE POLICY "bilinc_media_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'bilinc-media' AND owner = auth.uid());

CREATE POLICY "bilinc_media_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bilinc-media' AND owner = auth.uid());
```

> If you created the bucket as **public**, the SELECT policy above is optional
> (public buckets are readable without RLS), but it is harmless to keep it for
> when you switch to a private bucket.

## 3. CORS

Public buckets serve over the Supabase CDN and are readable cross-origin by
default. For the **web** app and **Expo** uploads you generally do not need to
touch CORS. If you later restrict the bucket or use signed upload URLs from a
browser, set CORS via **Dashboard → Storage → Settings → CORS** (or the
Management API):

```json
[
  {
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

Tighten `allowedOrigins` to your production web origin before launch.

## 4. App wiring

- Mobile uploads use `expo-image-picker` → `supabase.storage.from('bilinc-media').upload(...)`.
- Store the **public URL** (`getPublicUrl`) into the relevant `*_photos.url`
  columns (e.g. `review_photos.url`, `listing_photos.url`).
