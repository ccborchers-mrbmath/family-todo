-- Encouragement Wall: support photos and voice notes on posts, and longer messages.

-- Media columns. A post can now be just a photo or a voice note, so message is optional.
ALTER TABLE public.encouragement_messages
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_path TEXT;
ALTER TABLE public.encouragement_messages
  ALTER COLUMN message DROP NOT NULL;

-- Private bucket for encouragement media (photos + voice notes).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'encouragement-media', 'encouragement-media', false, 26214400,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic',
    'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Parents may upload only into their own family's folder ({family_id}/...).
CREATE POLICY "Parents upload encouragement media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'encouragement-media'
    AND public.has_role(auth.uid(), 'parent')
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

-- Parents may remove media in their own family's folder.
CREATE POLICY "Parents delete encouragement media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'encouragement-media'
    AND public.has_role(auth.uid(), 'parent')
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

-- Reads happen through service-role signed URLs generated in listEncouragement,
-- so no public SELECT policy is granted on the bucket.
