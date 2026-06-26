
CREATE TABLE public.encouragement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encouragement_messages TO authenticated;
GRANT ALL ON public.encouragement_messages TO service_role;

ALTER TABLE public.encouragement_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view wall"
  ON public.encouragement_messages FOR SELECT
  TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND (child_id = auth.uid() OR public.has_role(auth.uid(), 'parent'))
  );

CREATE POLICY "Parents can post in their family"
  ON public.encouragement_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND author_id = auth.uid()
    AND public.has_role(auth.uid(), 'parent')
  );

CREATE POLICY "Parents can delete in their family"
  ON public.encouragement_messages FOR DELETE
  TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND public.has_role(auth.uid(), 'parent')
  );

CREATE INDEX encouragement_messages_child_idx
  ON public.encouragement_messages (child_id, created_at DESC);
