-- Encouragement Wall: parents post encouraging messages that live on a child's page

CREATE TABLE public.encouragement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.encouragement_messages (child_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encouragement_messages TO authenticated;
GRANT ALL ON public.encouragement_messages TO service_role;
ALTER TABLE public.encouragement_messages ENABLE ROW LEVEL SECURITY;

-- The child the message is for can read their own wall; parents read everyone in the family.
CREATE POLICY "Read encouragement on own wall or as parent" ON public.encouragement_messages
  FOR SELECT TO authenticated
  USING (
    family_id = public.get_my_family_id() AND (
      child_id = auth.uid() OR public.has_role(auth.uid(), 'parent')
    )
  );

-- Only parents in the family may post, and they author as themselves.
CREATE POLICY "Parents post encouragement" ON public.encouragement_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND public.has_role(auth.uid(), 'parent')
    AND author_id = auth.uid()
  );

-- Parents in the family may remove messages.
CREATE POLICY "Parents delete encouragement" ON public.encouragement_messages
  FOR DELETE TO authenticated
  USING (
    family_id = public.get_my_family_id()
    AND public.has_role(auth.uid(), 'parent')
  );

-- Live updates so a child's wall lights up the moment a parent posts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.encouragement_messages;
