CREATE TABLE public.family_values (
  family_id uuid PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.family_values TO authenticated;
GRANT ALL ON public.family_values TO service_role;
ALTER TABLE public.family_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family can view values" ON public.family_values FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());
CREATE POLICY "Parents insert values" ON public.family_values FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE POLICY "Parents update values" ON public.family_values FOR UPDATE TO authenticated
  USING (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'))
  WITH CHECK (family_id = public.get_my_family_id() AND public.has_role(auth.uid(), 'parent'));
CREATE TRIGGER trg_family_values_updated BEFORE UPDATE ON public.family_values
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();