
-- Add media columns to encouragement_messages
ALTER TABLE public.encouragement_messages
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS voice_path text;

-- Require at least one of message/photo/voice
ALTER TABLE public.encouragement_messages
  ALTER COLUMN message DROP NOT NULL;

ALTER TABLE public.encouragement_messages
  DROP CONSTRAINT IF EXISTS encouragement_has_content;
ALTER TABLE public.encouragement_messages
  ADD CONSTRAINT encouragement_has_content CHECK (
    (message IS NOT NULL AND length(trim(message)) > 0)
    OR photo_path IS NOT NULL
    OR voice_path IS NOT NULL
  );

-- Storage RLS: media path must start with '<family_id>/...'
-- SELECT: any family member (parent or the child owning the wall)
CREATE POLICY "Family can read encouragement media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'encouragement-media'
  AND (storage.foldername(name))[1]::uuid = public.get_my_family_id()
);

-- INSERT: only parents in the family
CREATE POLICY "Parents can upload encouragement media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'encouragement-media'
  AND (storage.foldername(name))[1]::uuid = public.get_my_family_id()
  AND public.has_role(auth.uid(), 'parent')
  AND owner = auth.uid()
);

-- DELETE: only parents in the family
CREATE POLICY "Parents can delete encouragement media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'encouragement-media'
  AND (storage.foldername(name))[1]::uuid = public.get_my_family_id()
  AND public.has_role(auth.uid(), 'parent')
);
